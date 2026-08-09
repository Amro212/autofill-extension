import { defineUnlistedScript } from "#imports";

import { installMainWorldBridge } from "../src/bridge/main-world.js";

export default defineUnlistedScript(() => {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;
  const channelId = script.dataset.jobCopilotChannel;
  if (channelId === undefined) return;
  installMainWorldBridge(script, channelId);
});
