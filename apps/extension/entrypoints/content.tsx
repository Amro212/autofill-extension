import { browser, createShadowRootUi, defineContentScript } from "#imports";
import React from "react";
import ReactDOM from "react-dom/client";

import "../src/ui/content.css";
import { Panel } from "../src/ui/Panel.js";

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
