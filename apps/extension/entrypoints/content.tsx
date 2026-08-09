import { browser, createShadowRootUi, defineContentScript } from "#imports";
import {
  applicationSessionSchema,
  type ApplicationSession,
  type AutomationSettings,
  type DocumentMetadata,
  type PageAnswerRequest,
  type PageAnswerResult,
} from "@job-copilot/contracts";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import "../src/ui/content.css";
import { PageAutomationController } from "../src/automation/controller.js";
import { injectMainWorldBridge, type MainWorldBridge } from "../src/bridge/inject.js";
import { discoverFields } from "../src/fields/discover.js";
import { activeAtsAdapter } from "../src/adapters/registry.js";
import { DebugJournal } from "../src/debug/journal.js";
import { executeField } from "../src/fields/execute.js";
import { NormalizedFieldRegistry } from "../src/fields/registry.js";
import { FillController, type FillPageResult } from "../src/fill/controller.js";
import { extractJob } from "../src/jobs/extract.js";
import { NavigationController } from "../src/navigation/controller.js";
import {
  pageTransitionSignature,
  waitForPageTransition,
} from "../src/navigation/transition.js";
import { observeMutations } from "../src/observer/mutations.js";
import { mutationMayChangeApplication } from "../src/observer/relevance.js";
import { observeRoutes } from "../src/observer/routes.js";
import { classifyPage } from "../src/page-classifier/index.js";
import { uploadFile } from "../src/uploads/controller.js";
import { Panel, type PanelProps } from "../src/ui/Panel.js";
import { inspectValidation } from "../src/validation/inspect.js";
import { ValidationRepairController } from "../src/validation/repair.js";

type ContextStatus = NonNullable<PanelProps["contextStatus"]>;

function readContextStatus(value: unknown): ContextStatus | undefined {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return undefined;
  }
  if (
    value.status === "matched" &&
    "label" in value &&
    typeof value.label === "string"
  ) {
    return { status: "matched", label: value.label };
  }
  if (value.status === "ambiguous" && "candidates" in value && Array.isArray(value.candidates)) {
    const candidates = value.candidates.filter(
      (candidate): candidate is { jobId: string; label: string } =>
        typeof candidate === "object" &&
        candidate !== null &&
        "jobId" in candidate &&
        typeof candidate.jobId === "string" &&
        "label" in candidate &&
        typeof candidate.label === "string",
    );
    return candidates.length === 0 ? undefined : { status: "ambiguous", candidates };
  }
  return undefined;
}

function readApplicationSession(value: unknown): ApplicationSession | undefined {
  const candidate =
    typeof value === "object" && value !== null && "session" in value
      ? value.session
      : value;
  const parsed = applicationSessionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readDocumentContent(value: unknown):
  | { bytes: Uint8Array; filename: string; mediaType: string }
  | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("base64" in value) ||
    typeof value.base64 !== "string" ||
    !("filename" in value) ||
    typeof value.filename !== "string" ||
    !("mediaType" in value) ||
    typeof value.mediaType !== "string"
  ) {
    return undefined;
  }
  return {
    bytes: fromBase64(value.base64),
    filename: value.filename,
    mediaType: value.mediaType,
  };
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    let lastObservation = "";
    const fields = new NormalizedFieldRegistry();
    const journal = new DebugJournal();
    const selectedDocumentIds = new Set<string>();
    let currentContext: ContextStatus | undefined;
    let currentSession: ApplicationSession | undefined;
    let detectedFieldCount = 0;
    let mainWorldBridge: MainWorldBridge | undefined;
    const contextListeners = new Set<(status: ContextStatus | undefined) => void>();
    const fieldCountListeners = new Set<(count: number) => void>();
    const debugListeners = new Set<() => void>();
    const recordDebug = (type: string, data: unknown = {}) => {
      journal.record(type, data);
      for (const listener of debugListeners) listener();
    };
    const publishContext = (status: ContextStatus | undefined) => {
      currentContext = status;
      for (const listener of contextListeners) listener(status);
    };
    const pageKey = () => pageTransitionSignature(document, window);
    const answerPage = async (request: PageAnswerRequest): Promise<PageAnswerResult> => {
      recordDebug("ai-request", {
        task: "answer-page",
        fieldCount: request.fields.length,
        applicationId: request.applicationId,
      });
      try {
        const result = await browser.runtime.sendMessage({
          type: "JOB_COPILOT_ANSWER_PAGE",
          request,
        });
        recordDebug("ai-response", {
          task: "answer-page",
          answerCount: (result as PageAnswerResult).answers.length,
        });
        return result as PageAnswerResult;
      } catch (error) {
        recordDebug("error", {
          code: "LLM_PROVIDER_ERROR",
          message: error instanceof Error ? error.message : "AI request failed",
        });
        throw error;
      }
    };
    const execute: typeof executeField = async (discovered, value) => {
      try {
        mainWorldBridge ??= await injectMainWorldBridge();
        const result = await executeField(discovered, value, { bridge: mainWorldBridge });
        recordDebug("field-action", {
          fieldId: discovered.field.id,
          kind: discovered.field.kind,
          ok: result.ok,
          ...(result.reason === undefined ? {} : { reason: result.reason }),
        });
        return result;
      } catch {
        const result = await executeField(discovered, value);
        recordDebug("field-action", {
          fieldId: discovered.field.id,
          kind: discovered.field.kind,
          ok: result.ok,
          ...(result.reason === undefined ? {} : { reason: result.reason }),
        });
        return result;
      }
    };
    const inspectAndRecordValidation = (targetDocument: Document) => {
      const issues = inspectValidation(targetDocument, fields);
      recordDebug("validation", {
        count: issues.length,
        codes: issues.map(({ code }) => code),
      });
      return issues;
    };
    const fillController = new FillController({
      registry: fields,
      client: {
        answerPage,
        rewriteField: (request) =>
          browser.runtime.sendMessage({ type: "JOB_COPILOT_REWRITE_FIELD", request }),
      },
      execute,
    });
    let automationPromise: Promise<{ filled: number; failed: number }> | undefined;

    async function uploadDefaultDocuments(): Promise<{ uploaded: number; failed: number }> {
      const fileFields = fields.list().filter((field) => field.kind === "file");
      if (fileFields.length === 0) return { uploaded: 0, failed: 0 };
      const documents = (await browser.runtime.sendMessage(
        "JOB_COPILOT_GET_DOCUMENTS",
      )) as DocumentMetadata[];
      let uploaded = 0;
      let failed = 0;
      for (const field of fileFields) {
        const input = fields
          .elements(field.id)
          .find(
            (element): element is HTMLInputElement =>
              element instanceof HTMLInputElement && element.type === "file",
          );
        if (input === undefined || (input.files?.length ?? 0) > 0) continue;
        const kind = /cover\s*letter/i.test(`${field.label} ${field.semanticType ?? ""}`)
          ? "cover-letter"
          : "resume";
        let metadata: DocumentMetadata | undefined;
        if (currentSession !== undefined) {
          try {
            metadata = (await browser.runtime.sendMessage({
              type: "JOB_COPILOT_SELECT_DOCUMENT",
              applicationId: currentSession.id,
              kind,
            })) as DocumentMetadata;
          } catch {
            // Fall back to the local library selection below.
          }
        }
        metadata ??=
          documents.find((document) => document.kind === kind && document.isDefault) ??
          documents.find((document) => document.kind === kind);
        if (metadata === undefined) {
          if (field.required) failed += 1;
          recordDebug("error", { code: "UPLOAD_FAILED", fieldId: field.id });
          continue;
        }
        selectedDocumentIds.add(metadata.id);
        const content = readDocumentContent(
          await browser.runtime.sendMessage({
            type: "JOB_COPILOT_GET_DOCUMENT_CONTENT",
            id: metadata.id,
          }),
        );
        if (content === undefined) {
          failed += 1;
          recordDebug("error", { code: "UPLOAD_FAILED", documentId: metadata.id });
          continue;
        }
        const file = new File([Uint8Array.from(content.bytes).buffer], content.filename, {
          type: content.mediaType,
        });
        const result = await uploadFile(input, file, {
          acceptedState: () =>
            input.files?.[0]?.name === file.name &&
            ((document.body?.textContent ?? "").includes(file.name) ||
              input.value.endsWith(file.name)),
          timeoutMs: 5_000,
        });
        if (result.ok) {
          uploaded += 1;
          recordDebug("document-upload", {
            fieldId: field.id,
            documentId: metadata.id,
            kind,
            ok: true,
          });
        } else {
          failed += 1;
          recordDebug("error", {
            code: "UPLOAD_FAILED",
            fieldId: field.id,
            documentId: metadata.id,
            reason: result.reason,
          });
        }
      }
      return { uploaded, failed };
    }

    function runPageAutomation(): Promise<{ filled: number; failed: number }> {
      if (automationPromise !== undefined) return automationPromise;
      let resume = false;
      automationPromise = (async () => {
        const key = pageKey();
        if (currentSession === undefined) {
          return fillController.fillPage({ pageKey: key });
        }
        const settings = (await browser.runtime.sendMessage(
          "JOB_COPILOT_GET_SETTINGS",
        )) as AutomationSettings;
        let fillResult: FillPageResult = { filled: 0, failed: 0, results: [] };
        const repair = new ValidationRepairController({
          registry: fields,
          answerPage,
          execute,
        });
        const automation = new PageAutomationController({
          transition: async (state) => {
            const response = await browser.runtime.sendMessage({
              type: "JOB_COPILOT_TRANSITION_APPLICATION",
              id: currentSession!.id,
              state,
            });
            const session = readApplicationSession(response);
            if (session === undefined) throw new Error("Application transition failed");
            currentSession = session;
            recordDebug("state-transition", { state: session.state });
            return session.state;
          },
          fillPage: async (input) => {
            fillResult = await fillController.fillPage(input);
            return fillResult;
          },
          uploadDocuments: uploadDefaultDocuments,
          inspectValidation: () => inspectAndRecordValidation(document),
          repairPage: () =>
            repair.repairPage(document, {
              pageKey: key,
              applicationId: currentSession!.id,
            }),
          advance: (targetDocument, navigationSettings) => {
            const before = pageTransitionSignature(targetDocument, window);
            return new NavigationController({
              inspectValidation: () => inspectAndRecordValidation(targetDocument),
              waitForTransition: () =>
                waitForPageTransition(targetDocument, window, before, { timeoutMs: 8_000 }),
            }).advance(targetDocument, navigationSettings);
          },
        });
        const result = await automation.run(document, {
          applicationId: currentSession.id,
          pageKey: key,
          state: currentSession.state,
          classification: classifyPage(document),
          settings,
        });
        recordDebug("automation-result", {
          status: result.status,
          filled: fillResult.filled,
          failed: fillResult.failed,
        });
        resume = result.status === "navigated" || result.status === "captcha-cleared";
        return fillResult;
      })().finally(() => {
        automationPromise = undefined;
        if (resume) {
          lastObservation = "";
          queueMicrotask(() => void inspectPage());
        }
      });
      return automationPromise;
    }
    const panelApi: Omit<
      PanelProps,
      "contextStatus" | "confirmJobContext"
    > = {
      checkHealth: () => browser.runtime.sendMessage("JOB_COPILOT_HEALTH"),
      pairBackend: async (pairingSecret) => {
        const paired = await browser.runtime.sendMessage({
          type: "PAIR_BACKEND",
          pairingSecret,
        });
        lastObservation = "";
        await inspectPage();
        return paired;
      },
      getProfile: () => browser.runtime.sendMessage("JOB_COPILOT_GET_PROFILE"),
      updateProfile: (update) =>
        browser.runtime.sendMessage({
          type: "JOB_COPILOT_UPDATE_PROFILE",
          update,
        }),
      getSettings: () => browser.runtime.sendMessage("JOB_COPILOT_GET_SETTINGS"),
      getRuntimeConfig: () => browser.runtime.sendMessage("JOB_COPILOT_GET_RUNTIME_CONFIG"),
      listMemories: () => browser.runtime.sendMessage("JOB_COPILOT_GET_MEMORIES"),
      updateSettings: (update) =>
        browser.runtime.sendMessage({
          type: "JOB_COPILOT_UPDATE_SETTINGS",
          update,
        }),
      listDocuments: () => browser.runtime.sendMessage("JOB_COPILOT_GET_DOCUMENTS"),
      uploadDocument: async ({ file, kind }) =>
        browser.runtime.sendMessage({
          type: "JOB_COPILOT_UPLOAD_DOCUMENT",
          base64: toBase64(await file.arrayBuffer()),
          filename: file.name,
          mediaType: file.type,
          kind,
        }),
      setDefaultDocument: (id) =>
        browser.runtime.sendMessage({
          type: "JOB_COPILOT_SET_DEFAULT_DOCUMENT",
          id,
        }),
      parseResume: (id) =>
        browser.runtime.sendMessage({
          type: "JOB_COPILOT_PARSE_RESUME",
          id,
        }),
      generateResume: async (sourceDocumentId) => {
        if (currentSession?.jobId === undefined) throw new Error("Capture job context first");
        const result = await browser.runtime.sendMessage({
          type: "JOB_COPILOT_GENERATE_RESUME",
          sourceDocumentId,
          jobId: currentSession.jobId,
          applicationId: currentSession.id,
        });
        return result.documents;
      },
      generateCoverLetter: async (sourceDocumentId) => {
        if (currentSession?.jobId === undefined) throw new Error("Capture job context first");
        const result = await browser.runtime.sendMessage({
          type: "JOB_COPILOT_GENERATE_COVER_LETTER",
          sourceDocumentId,
          jobId: currentSession.jobId,
          applicationId: currentSession.id,
        });
        return result.documents;
      },
      fillPage: () => runPageAutomation(),
      undoLast: () => fillController.undoLast(),
      scanPage: async () => {
        lastObservation = "";
        await inspectPage();
      },
      retryFailed: () => runPageAutomation(),
      pauseResume: async () => {
        if (currentSession === undefined) return;
        const state = currentSession.state === "PAUSED" ? "SCANNING" : "PAUSED";
        currentSession = readApplicationSession(
          await browser.runtime.sendMessage({
            type: "JOB_COPILOT_TRANSITION_APPLICATION",
            id: currentSession.id,
            state,
          }),
        );
        recordDebug("state-transition", { state });
      },
      exportDebugBundle: async () => {
        const adapterId = activeAtsAdapter(document).id;
        const bundle = journal.bundle({
          adapterId,
          ...(currentSession === undefined ? {} : { sessionId: currentSession.id }),
          page: new URL(location.href),
          fields: fields.list().map((field) => ({
            id: field.id,
            kind: field.kind,
            label: field.label,
            required: field.required,
          })),
        });
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `job-copilot-debug-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    };

    function RuntimePanel() {
      const [contextStatus, setContextStatus] = useState(currentContext);
      const [fieldCount, setFieldCount] = useState(detectedFieldCount);
      const [, setDebugRevision] = useState(0);
      useEffect(() => {
        contextListeners.add(setContextStatus);
        fieldCountListeners.add(setFieldCount);
        const refreshDebug = () => setDebugRevision((revision) => revision + 1);
        debugListeners.add(refreshDebug);
        return () => {
          contextListeners.delete(setContextStatus);
          fieldCountListeners.delete(setFieldCount);
          debugListeners.delete(refreshDebug);
        };
      }, []);
      const events = journal.events();
      const errors = events.flatMap((event) => {
        if (event.type !== "error" || typeof event.data !== "object" || event.data === null) {
          return [];
        }
        return "code" in event.data && typeof event.data.code === "string"
          ? [event.data.code]
          : ["UNKNOWN_ERROR"];
      });
      return (
        <Panel
          {...panelApi}
          {...(contextStatus === undefined ? {} : { contextStatus })}
          detectedFieldCount={fieldCount}
          applicationStatus={{
            adapterId: activeAtsAdapter(document).id,
            ...(currentSession === undefined
              ? {}
              : { sessionId: currentSession.id, state: currentSession.state }),
            step: pageKey(),
            selectedDocuments: selectedDocumentIds.size,
          }}
          debugStatus={{
            fieldCount,
            recentActions: events.slice(-8).map(({ type }) => type),
            errors: [...new Set(errors)].slice(-8),
          }}
          confirmJobContext={async (jobId) => {
            const response = await browser.runtime.sendMessage({
              type: "JOB_COPILOT_CONFIRM_JOB_CONTEXT",
              jobId,
              adapterId: activeAtsAdapter(document).id,
            });
            currentSession = readApplicationSession(response);
            recordDebug("job-context", {
              status: readContextStatus(response)?.status ?? "missing",
            });
            publishContext(readContextStatus(response));
          }}
        />
      );
    }

    async function inspectPage() {
      fields.reconcile(discoverFields(document, pageKey()));
      const nextFieldCount = fields.list().length;
      if (nextFieldCount !== detectedFieldCount) {
        detectedFieldCount = nextFieldCount;
        for (const listener of fieldCountListeners) listener(nextFieldCount);
      }
      const classification = classifyPage(document);
      recordDebug("scan", {
        adapterId: activeAtsAdapter(document).id,
        pageType: classification.type,
        fieldCount: fields.list().length,
        pathname: location.pathname,
      });
      const signature = `${location.href}|${classification.type}`;
      if (signature === lastObservation) return;
      try {
        if (classification.type === "job-listing") {
          await browser.runtime.sendMessage({
            type: "JOB_COPILOT_CAPTURE_JOB",
            job: extractJob(document, new URL(location.href)),
          });
          recordDebug("job-capture", { status: "captured" });
        } else if (
          classification.type === "application" ||
          classification.type === "review"
        ) {
          const context = await browser.runtime.sendMessage({
            type: "JOB_COPILOT_APPLICATION_PAGE",
            url: location.href,
            adapterId: activeAtsAdapter(document).id,
          });
          currentSession = readApplicationSession(context);
          recordDebug("application-context", {
            status: readContextStatus(context)?.status ?? "missing",
            sessionId: currentSession?.id,
          });
          publishContext(readContextStatus(context));
          let resumeAfterSubmitFailure = false;
          if (currentSession?.state === "SUBMITTING") {
            currentSession = readApplicationSession(
              await browser.runtime.sendMessage({
                type: "JOB_COPILOT_TRANSITION_APPLICATION",
                id: currentSession.id,
                state: "FAILED",
              }),
            );
            resumeAfterSubmitFailure = currentSession?.state === "FAILED";
          }
          const settings = (await browser.runtime.sendMessage(
            "JOB_COPILOT_GET_SETTINGS",
          )) as AutomationSettings;
          if (
            currentSession !== undefined &&
            (settings.autopilot ||
              currentSession.state === "SCANNING" ||
              currentSession.state === "NAVIGATING" ||
              currentSession.state === "AWAITING_CAPTCHA" ||
              currentSession.state === "USER_BOUNDARY" ||
              resumeAfterSubmitFailure)
          ) {
            void runPageAutomation();
          }
        } else if (
          classification.type === "captcha" ||
          classification.type === "boundary" ||
          classification.type === "confirmation"
        ) {
          const recovered = await browser.runtime.sendMessage({
            type: "JOB_COPILOT_RECOVER_SESSION",
          });
          currentSession = readApplicationSession(recovered);
          if (
            classification.type === "confirmation" &&
            currentSession?.state === "SUBMITTING"
          ) {
            currentSession = readApplicationSession(
              await browser.runtime.sendMessage({
                type: "JOB_COPILOT_TRANSITION_APPLICATION",
                id: currentSession.id,
                state: "SUBMITTED",
              }),
            );
          } else if (
            currentSession !== undefined &&
            (currentSession.state === "SCANNING" ||
              currentSession.state === "AWAITING_CAPTCHA")
          ) {
            void runPageAutomation();
          }
        }
        lastObservation = signature;
      } catch (error) {
        recordDebug("error", {
          code: "FIELD_DISCOVERY_FAILED",
          message: error instanceof Error ? error.message : "Page inspection failed",
        });
        lastObservation = "";
      }
    }

    const ui = await createShadowRootUi(ctx, {
      name: "job-copilot-panel",
      position: "inline",
      anchor: "body",
      isolateEvents: true,
      onMount(container) {
        const app = document.createElement("div");
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<RuntimePanel />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    const stopMutations = observeMutations(document.body, (batch) => {
      if (mutationMayChangeApplication(batch)) void inspectPage();
    });
    const stopRoutes = observeRoutes(window, () => void inspectPage());
    ctx.onInvalidated(() => {
      stopMutations();
      stopRoutes();
      mainWorldBridge?.dispose();
    });
    await inspectPage();
  },
});
