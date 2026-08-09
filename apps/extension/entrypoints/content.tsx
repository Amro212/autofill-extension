import { browser, createShadowRootUi, defineContentScript } from "#imports";
import React from "react";
import ReactDOM from "react-dom/client";

import "../src/ui/content.css";
import { ConnectionPanel } from "../src/ui/ConnectionPanel.js";

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
          <ConnectionPanel
            checkHealth={() => browser.runtime.sendMessage("JOB_COPILOT_HEALTH")}
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
