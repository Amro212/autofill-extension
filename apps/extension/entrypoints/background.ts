import { browser, defineBackground } from "#imports";

import { createBackendClient } from "../src/api/client.js";

const TOKEN_KEY = "job-copilot:pairing-token";

export default defineBackground(() => {
  const client = createBackendClient({
    getToken: async () => {
      const stored = await browser.storage.local.get(TOKEN_KEY);
      return typeof stored[TOKEN_KEY] === "string" ? stored[TOKEN_KEY] : null;
    },
    saveToken: async (token) => {
      await browser.storage.local.set({ [TOKEN_KEY]: token });
    },
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (message === "JOB_COPILOT_HEALTH") return client.health();
    if (message === "JOB_COPILOT_GET_PROFILE") return client.getProfile();
    if (message === "JOB_COPILOT_GET_SETTINGS") return client.getSettings();
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "PAIR_BACKEND" &&
      "pairingSecret" in message &&
      typeof message.pairingSecret === "string"
    ) {
      return client.pair(message.pairingSecret);
    }
    if (typeof message === "object" && message !== null && "type" in message) {
      if (message.type === "JOB_COPILOT_UPDATE_PROFILE" && "update" in message) {
        return client.updateProfile(message.update as never);
      }
      if (message.type === "JOB_COPILOT_UPDATE_SETTINGS" && "update" in message) {
        return client.updateSettings(message.update as never);
      }
    }
    return undefined;
  });
});
