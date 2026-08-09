import { browser, createShadowRootUi, defineContentScript } from "#imports";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import "../src/ui/content.css";
import { discoverFields } from "../src/fields/discover.js";
import { NormalizedFieldRegistry } from "../src/fields/registry.js";
import { extractJob } from "../src/jobs/extract.js";
import { observeMutations } from "../src/observer/mutations.js";
import { observeRoutes } from "../src/observer/routes.js";
import { classifyPage } from "../src/page-classifier/index.js";
import { Panel, type PanelProps } from "../src/ui/Panel.js";

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

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    let lastObservation = "";
    const fields = new NormalizedFieldRegistry();
    let currentContext: ContextStatus | undefined;
    const contextListeners = new Set<(status: ContextStatus | undefined) => void>();
    const publishContext = (status: ContextStatus | undefined) => {
      currentContext = status;
      for (const listener of contextListeners) listener(status);
    };
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
    };

    function RuntimePanel() {
      const [contextStatus, setContextStatus] = useState(currentContext);
      useEffect(() => {
        contextListeners.add(setContextStatus);
        return () => {
          contextListeners.delete(setContextStatus);
        };
      }, []);
      return (
        <Panel
          {...panelApi}
          {...(contextStatus === undefined ? {} : { contextStatus })}
          confirmJobContext={async (jobId) => {
            const response = await browser.runtime.sendMessage({
              type: "JOB_COPILOT_CONFIRM_JOB_CONTEXT",
              jobId,
            });
            publishContext(readContextStatus(response));
          }}
        />
      );
    }

    async function inspectPage() {
      fields.reconcile(discoverFields(document, `${location.origin}${location.pathname}`));
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
          });
          publishContext(readContextStatus(context));
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
    const stopMutations = observeMutations(document.body, () => void inspectPage());
    const stopRoutes = observeRoutes(window, () => void inspectPage());
    ctx.onInvalidated(() => {
      stopMutations();
      stopRoutes();
    });
    await inspectPage();
  },
});
