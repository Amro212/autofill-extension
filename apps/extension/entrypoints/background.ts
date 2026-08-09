import { browser, defineBackground } from "#imports";
import {
  applicantProfileUpdateSchema,
  automationSettingsUpdateSchema,
  documentKindSchema,
  documentMediaTypeSchema,
} from "@job-copilot/contracts";

import { createBackendClient } from "../src/api/client.js";

const TOKEN_KEY = "job-copilot:pairing-token";
const MAX_BASE64_DOCUMENT_LENGTH = 13_981_020;

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
    if (message === "JOB_COPILOT_GET_DOCUMENTS") return client.getDocuments();
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
        const update = applicantProfileUpdateSchema.safeParse(message.update);
        if (update.success) return client.updateProfile(update.data);
      }
      if (message.type === "JOB_COPILOT_UPDATE_SETTINGS" && "update" in message) {
        const update = automationSettingsUpdateSchema.safeParse(message.update);
        if (update.success) return client.updateSettings(update.data);
      }
      if (
        message.type === "JOB_COPILOT_SET_DEFAULT_DOCUMENT" &&
        "id" in message &&
        typeof message.id === "string"
      ) {
        return client.setDefaultDocument(message.id);
      }
      if (
        message.type === "JOB_COPILOT_UPLOAD_DOCUMENT" &&
        "base64" in message &&
        typeof message.base64 === "string" &&
        message.base64.length <= MAX_BASE64_DOCUMENT_LENGTH &&
        "filename" in message &&
        typeof message.filename === "string" &&
        "mediaType" in message &&
        "kind" in message
      ) {
        const mediaType = documentMediaTypeSchema.safeParse(message.mediaType);
        const kind = documentKindSchema.safeParse(message.kind);
        if (!mediaType.success || !kind.success) return undefined;
        const binary = atob(message.base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return client.uploadDocument({
          bytes: new Blob([bytes], { type: mediaType.data }),
          filename: message.filename,
          kind: kind.data,
        });
      }
    }
    return undefined;
  });
});
