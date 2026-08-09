const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /^(?:value|previousValue|currentValue|raw|bytes|base64|token|authorization|secret|password|prompt|output|response)$/i;

export interface DebugEvent {
  at: string;
  type: string;
  data: unknown;
}

export interface DebugFieldSummary {
  id: string;
  kind: string;
  label: string;
  required: boolean;
}

export interface DebugBundleContext {
  adapterId: string;
  sessionId?: string;
  page: URL;
  fields: DebugFieldSummary[];
}

export interface DebugBundle {
  format: "job-copilot-debug-v1";
  generatedAt: string;
  adapterId: string;
  sessionId?: string;
  page: { origin: string; pathname: string };
  fields: DebugFieldSummary[];
  events: DebugEvent[];
}

function sanitizeString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/\bBearer\s+[A-Z0-9._~+/=-]+/gi, REDACTED)
    .replace(/\b(?:\+?\d[\d ().-]{7,}\d)\b/g, REDACTED);
}

function sanitize(value: unknown, key?: string): unknown {
  if (key !== undefined && SENSITIVE_KEY.test(key)) return REDACTED;
  if (typeof value === "string") return sanitizeString(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === undefined
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]),
    );
  }
  return String(value);
}

export class DebugJournal {
  readonly #events: DebugEvent[] = [];
  readonly #maxEvents: number;

  constructor(options: { maxEvents?: number } = {}) {
    this.#maxEvents = Math.min(Math.max(options.maxEvents ?? 200, 1), 1_000);
  }

  record(type: string, data: unknown = {}): void {
    this.#events.push({
      at: new Date().toISOString(),
      type,
      data: sanitize(data),
    });
    if (this.#events.length > this.#maxEvents) {
      this.#events.splice(0, this.#events.length - this.#maxEvents);
    }
  }

  events(): DebugEvent[] {
    return this.#events.map((event) => structuredClone(event));
  }

  bundle(context: DebugBundleContext): DebugBundle {
    return {
      format: "job-copilot-debug-v1",
      generatedAt: new Date().toISOString(),
      adapterId: context.adapterId,
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      page: { origin: context.page.origin, pathname: context.page.pathname },
      fields: context.fields.map((field) => ({ ...field })),
      events: this.events(),
    };
  }
}
