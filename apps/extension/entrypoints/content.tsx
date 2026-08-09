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
    let currentContext: ContextStatus | undefined;
    let currentSession: ApplicationSession | undefined;
    let detectedFieldCount = 0;
    let mainWorldBridge: MainWorldBridge | undefined;
    const contextListeners = new Set<(status: ContextStatus | undefined) => void>();
    const fieldCountListeners = new Set<(count: number) => void>();
    const publishContext = (status: ContextStatus | undefined) => {
      currentContext = status;
      for (const listener of contextListeners) listener(status);
    };
    const pageKey = () => pageTransitionSignature(document, window);
    const answerPage = (request: PageAnswerRequest): Promise<PageAnswerResult> =>
      browser.runtime.sendMessage({ type: "JOB_COPILOT_ANSWER_PAGE", request });
    const execute: typeof executeField = async (discovered, value) => {
      try {
        mainWorldBridge ??= await injectMainWorldBridge();
        return executeField(discovered, value, { bridge: mainWorldBridge });
      } catch {
        return executeField(discovered, value);
      }
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
        const metadata =
          documents.find((document) => document.kind === kind && document.isDefault) ??
          documents.find((document) => document.kind === kind);
        if (metadata === undefined) {
          if (field.required) failed += 1;
          continue;
        }
        const content = readDocumentContent(
          await browser.runtime.sendMessage({
            type: "JOB_COPILOT_GET_DOCUMENT_CONTENT",
            id: metadata.id,
          }),
        );
        if (content === undefined) {
          failed += 1;
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
        if (result.ok) uploaded += 1;
        else failed += 1;
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
            return session.state;
          },
          fillPage: async (input) => {
            fillResult = await fillController.fillPage(input);
            return fillResult;
          },
          uploadDocuments: uploadDefaultDocuments,
          inspectValidation: () => inspectValidation(document, fields),
          repairPage: () =>
            repair.repairPage(document, {
              pageKey: key,
              applicationId: currentSession!.id,
            }),
          advance: (targetDocument, navigationSettings) => {
            const before = pageTransitionSignature(targetDocument, window);
            return new NavigationController({
              inspectValidation: () => inspectValidation(targetDocument, fields),
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
      fillPage: () => runPageAutomation(),
      undoLast: () => fillController.undoLast(),
    };

    function RuntimePanel() {
      const [contextStatus, setContextStatus] = useState(currentContext);
      const [fieldCount, setFieldCount] = useState(detectedFieldCount);
      useEffect(() => {
        contextListeners.add(setContextStatus);
        fieldCountListeners.add(setFieldCount);
        return () => {
          contextListeners.delete(setContextStatus);
          fieldCountListeners.delete(setFieldCount);
        };
      }, []);
      return (
        <Panel
          {...panelApi}
          {...(contextStatus === undefined ? {} : { contextStatus })}
          detectedFieldCount={fieldCount}
          confirmJobContext={async (jobId) => {
            const response = await browser.runtime.sendMessage({
              type: "JOB_COPILOT_CONFIRM_JOB_CONTEXT",
              jobId,
              adapterId: activeAtsAdapter(document).id,
            });
            currentSession = readApplicationSession(response);
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
      const signature = `${location.href}|${classification.type}`;
      if (signature === lastObservation) return;
      try {
        if (classification.type === "job-listing") {
          await browser.runtime.sendMessage({
            type: "JOB_COPILOT_CAPTURE_JOB",
            job: extractJob(document, new URL(location.href)),
          });
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
      } catch {
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
