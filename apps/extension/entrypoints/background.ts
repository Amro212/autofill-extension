import { browser, defineBackground } from "#imports";
import {
  applicantProfileUpdateSchema,
  applicationTransitionSchema,
  automationSettingsUpdateSchema,
  documentKindSchema,
  documentMediaTypeSchema,
  jobCaptureSchema,
  pageAnswerRequestSchema,
  rewriteRequestSchema,
  type JobRecord,
} from "@job-copilot/contracts";

import { createBackendClient } from "../src/api/client.js";
import {
  correlateJobContext,
  type ApplicationContext,
  type PendingJobContext,
} from "../src/jobs/correlate.js";
import { SessionController } from "../src/sessions/controller.js";

const TOKEN_KEY = "job-copilot:pairing-token";
const MAX_BASE64_DOCUMENT_LENGTH = 13_981_020;
const PENDING_JOBS_KEY = "job-copilot:pending-jobs";
const TAB_SESSIONS_KEY = "job-copilot:tab-sessions";
const PENDING_TTL_MS = 30 * 60 * 1_000;

interface StoredPendingJob extends PendingJobContext {
  label: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

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
  const tabStore = {
    async get(tabId: number) {
      const stored = await browser.storage.local.get(TAB_SESSIONS_KEY);
      const map = asRecord(stored[TAB_SESSIONS_KEY]);
      return typeof map[String(tabId)] === "string"
        ? (map[String(tabId)] as string)
        : null;
    },
    async set(tabId: number, applicationId: string) {
      const stored = await browser.storage.local.get(TAB_SESSIONS_KEY);
      const map = asRecord(stored[TAB_SESSIONS_KEY]);
      await browser.storage.local.set({
        [TAB_SESSIONS_KEY]: { ...map, [String(tabId)]: applicationId },
      });
    },
  };
  const sessions = new SessionController(client, tabStore);

  async function readPendingJobs(): Promise<StoredPendingJob[]> {
    const stored = await browser.storage.local.get(PENDING_JOBS_KEY);
    if (!Array.isArray(stored[PENDING_JOBS_KEY])) return [];
    const cutoff = Date.now() - PENDING_TTL_MS;
    return (stored[PENDING_JOBS_KEY] as StoredPendingJob[]).filter(
      (job) => Date.parse(job.capturedAt) >= cutoff,
    );
  }

  async function rememberJob(job: JobRecord, sourceTabId: number) {
    const current = await readPendingJobs();
    const pending: StoredPendingJob = {
      jobId: job.id,
      sourceTabId,
      capturedAt: job.capturedAt,
      label: [job.title, job.company].filter(Boolean).join(" · ") || "Captured job",
      ...(job.applicationUrl === undefined
        ? {}
        : { applicationUrl: job.applicationUrl }),
      ...(job.company === undefined ? {} : { company: job.company }),
      ...(job.title === undefined ? {} : { title: job.title }),
    };
    const deduplicated = current.filter(
      (candidate) =>
        candidate.jobId !== job.id &&
        candidate.applicationUrl !== job.applicationUrl,
    );
    await browser.storage.local.set({
      [PENDING_JOBS_KEY]: [pending, ...deduplicated].slice(0, 20),
    });
  }

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (message === "JOB_COPILOT_HEALTH") return client.health();
    if (message === "JOB_COPILOT_GET_PROFILE") return client.getProfile();
    if (message === "JOB_COPILOT_GET_SETTINGS") return client.getSettings();
    if (message === "JOB_COPILOT_GET_DOCUMENTS") return client.getDocuments();
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "JOB_COPILOT_SELECT_DOCUMENT" &&
      "applicationId" in message &&
      typeof message.applicationId === "string" &&
      "kind" in message
    ) {
      const kind = documentKindSchema.safeParse(message.kind);
      if (!kind.success) return undefined;
      return client.selectApplicationDocument(message.applicationId, kind.data);
    }
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
      if (message.type === "JOB_COPILOT_ANSWER_PAGE" && "request" in message) {
        const request = pageAnswerRequestSchema.safeParse(message.request);
        if (request.success) return client.answerPage(request.data);
      }
      if (message.type === "JOB_COPILOT_REWRITE_FIELD" && "request" in message) {
        const request = rewriteRequestSchema.safeParse(message.request);
        if (request.success) return client.rewriteField(request.data);
      }
      if (
        message.type === "JOB_COPILOT_TRANSITION_APPLICATION" &&
        "id" in message &&
        typeof message.id === "string" &&
        "state" in message
      ) {
        const transition = applicationTransitionSchema.safeParse({ state: message.state });
        if (transition.success) {
          return client.transitionApplication(message.id, transition.data.state);
        }
      }
      if (
        message.type === "JOB_COPILOT_GET_DOCUMENT_CONTENT" &&
        "id" in message &&
        typeof message.id === "string"
      ) {
        return client.getDocumentContent(message.id).then((document) => ({
          base64: toBase64(document.bytes),
          filename: document.filename,
          mediaType: document.mediaType,
        }));
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
      if (message.type === "JOB_COPILOT_CAPTURE_JOB" && "job" in message) {
        const job = jobCaptureSchema.safeParse(message.job);
        const sourceTabId = sender.tab?.id;
        if (!job.success || sourceTabId === undefined) return undefined;
        return client.captureJob(job.data).then(async (captured) => {
          await rememberJob(captured, sourceTabId);
          return captured;
        });
      }
      if (
        message.type === "JOB_COPILOT_APPLICATION_PAGE" &&
        "url" in message &&
        typeof message.url === "string" &&
        sender.tab?.id !== undefined
      ) {
        const target: ApplicationContext = {
          tabId: sender.tab.id,
          url: message.url,
          ...(sender.tab.openerTabId === undefined
            ? {}
            : { openerTabId: sender.tab.openerTabId }),
          ...("company" in message && typeof message.company === "string"
            ? { company: message.company }
            : {}),
          ...("title" in message && typeof message.title === "string"
            ? { title: message.title }
            : {}),
          ...("jobId" in message && typeof message.jobId === "string"
            ? { jobId: message.jobId }
            : {}),
        };
        const adapterId =
          "adapterId" in message && typeof message.adapterId === "string"
            ? message.adapterId
            : undefined;
        return readPendingJobs().then(async (pending) => {
          const correlation = correlateJobContext(pending, target);
          if (correlation.status === "ambiguous") {
            return {
              ...correlation,
              candidates: correlation.jobIds.flatMap((jobId) => {
                const job = pending.find((candidate) => candidate.jobId === jobId);
                return job === undefined ? [] : [{ jobId, label: job.label }];
              }),
            };
          }
          if (correlation.status !== "matched") return correlation;
          const matched = pending.find((job) => job.jobId === correlation.jobId);
          try {
            const recovered = await sessions.recover(target.tabId);
            return {
              ...correlation,
              label: matched?.label ?? "Captured job",
              session: recovered,
            };
          } catch {
            const source = matched;
            const activeTabIds = [...new Set([
              ...(source === undefined ? [] : [source.sourceTabId]),
              target.tabId,
            ])];
            const session = await sessions.start({
              jobId: correlation.jobId,
              ...(source === undefined
                ? {}
                : { originatingTabId: source.sourceTabId }),
              activeTabIds,
              ...(adapterId === undefined ? {} : { adapterId }),
            });
            return {
              ...correlation,
              label: source?.label ?? "Captured job",
              session,
            };
          }
        });
      }
      if (
        message.type === "JOB_COPILOT_CONFIRM_JOB_CONTEXT" &&
        "jobId" in message &&
        typeof message.jobId === "string" &&
        sender.tab?.id !== undefined
      ) {
        return readPendingJobs().then(async (pending) => {
          const source = pending.find((job) => job.jobId === message.jobId);
          if (source === undefined) throw new Error("Pending job context expired");
          const tabId = sender.tab!.id!;
          const session = await sessions.start({
            jobId: source.jobId,
            originatingTabId: source.sourceTabId,
            activeTabIds: [...new Set([source.sourceTabId, tabId])],
            ...("adapterId" in message && typeof message.adapterId === "string"
              ? { adapterId: message.adapterId }
              : {}),
          });
          return {
            status: "matched" as const,
            jobId: source.jobId,
            label: source.label,
            session,
          };
        });
      }
      if (
        message.type === "JOB_COPILOT_RECOVER_SESSION" &&
        sender.tab?.id !== undefined
      ) {
        return sessions.recover(sender.tab.id);
      }
    }
    return undefined;
  });
});
