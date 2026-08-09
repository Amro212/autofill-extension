import { browser, createShadowRootUi, defineContentScript } from "#imports";
import React from "react";
import ReactDOM from "react-dom/client";

import "../src/ui/content.css";
import { Panel } from "../src/ui/Panel.js";

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
    const ui = await createShadowRootUi(ctx, {
      name: "job-copilot-panel",
      position: "inline",
      anchor: "body",
      isolateEvents: true,
      onMount(container) {
        const app = document.createElement("div");
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(
          <Panel
            checkHealth={() => browser.runtime.sendMessage("JOB_COPILOT_HEALTH")}
            pairBackend={(pairingSecret) =>
              browser.runtime.sendMessage({ type: "PAIR_BACKEND", pairingSecret })
            }
            getProfile={() => browser.runtime.sendMessage("JOB_COPILOT_GET_PROFILE")}
            updateProfile={(update) =>
              browser.runtime.sendMessage({
                type: "JOB_COPILOT_UPDATE_PROFILE",
                update,
              })
            }
            getSettings={() => browser.runtime.sendMessage("JOB_COPILOT_GET_SETTINGS")}
            updateSettings={(update) =>
              browser.runtime.sendMessage({
                type: "JOB_COPILOT_UPDATE_SETTINGS",
                update,
              })
            }
            listDocuments={() =>
              browser.runtime.sendMessage("JOB_COPILOT_GET_DOCUMENTS")
            }
            uploadDocument={async ({ file, kind }) =>
              browser.runtime.sendMessage({
                type: "JOB_COPILOT_UPLOAD_DOCUMENT",
                base64: toBase64(await file.arrayBuffer()),
                filename: file.name,
                mediaType: file.type,
                kind,
              })
            }
            setDefaultDocument={(id) =>
              browser.runtime.sendMessage({
                type: "JOB_COPILOT_SET_DEFAULT_DOCUMENT",
                id,
              })
            }
          />,
        );
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
