export const BRIDGE_REQUEST_EVENT = "job-copilot:field-action";
export const BRIDGE_RESPONSE_EVENT = "job-copilot:field-result";

const channelPattern = /^[a-f0-9]{32}$/;
const identifierPattern = /^[A-Za-z0-9_-]{1,128}$/;

export type BridgeAction =
  | { type: "set-value"; targetId: string; value: string }
  | { type: "set-checked"; targetId: string; checked: boolean }
  | { type: "set-content"; targetId: string; value: string };

export interface BridgeRequest {
  channelId: string;
  requestId: string;
  action: BridgeAction;
}

export type BridgeResponse =
  | {
      channelId: string;
      requestId: string;
      ok: true;
      actualValue: string | boolean;
    }
  | {
      channelId: string;
      requestId: string;
      ok: false;
      error: string;
    };

interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function invalid(message: string): never {
  throw new TypeError(message);
}

function parseAction(value: unknown): BridgeAction {
  const action = record(value);
  if (action === undefined || typeof action.type !== "string") {
    return invalid("Invalid bridge action");
  }
  if (
    typeof action.targetId !== "string" ||
    !identifierPattern.test(action.targetId)
  ) {
    return invalid("Invalid bridge target");
  }
  if (action.type === "set-checked") {
    if (
      !hasOnlyKeys(action, ["type", "targetId", "checked"]) ||
      typeof action.checked !== "boolean"
    ) {
      return invalid("Invalid checked action");
    }
    return {
      type: "set-checked",
      targetId: action.targetId,
      checked: action.checked,
    };
  }
  if (action.type === "set-value" || action.type === "set-content") {
    if (
      !hasOnlyKeys(action, ["type", "targetId", "value"]) ||
      typeof action.value !== "string" ||
      action.value.length > 20_000
    ) {
      return invalid("Invalid value action");
    }
    return { type: action.type, targetId: action.targetId, value: action.value };
  }
  return invalid("Unsupported bridge action");
}

export const bridgeRequestSchema: RuntimeSchema<BridgeRequest> = {
  parse(value) {
    const request = record(value);
    if (
      request === undefined ||
      !hasOnlyKeys(request, ["channelId", "requestId", "action"]) ||
      typeof request.channelId !== "string" ||
      !channelPattern.test(request.channelId) ||
      typeof request.requestId !== "string" ||
      !identifierPattern.test(request.requestId)
    ) {
      return invalid("Invalid bridge request");
    }
    return {
      channelId: request.channelId,
      requestId: request.requestId,
      action: parseAction(request.action),
    };
  },
};

export const bridgeResponseSchema: RuntimeSchema<BridgeResponse> = {
  parse(value) {
    const response = record(value);
    if (
      response === undefined ||
      typeof response.channelId !== "string" ||
      !channelPattern.test(response.channelId) ||
      typeof response.requestId !== "string" ||
      !identifierPattern.test(response.requestId) ||
      typeof response.ok !== "boolean"
    ) {
      return invalid("Invalid bridge response");
    }
    if (response.ok) {
      if (
        !hasOnlyKeys(response, ["channelId", "requestId", "ok", "actualValue"]) ||
        (typeof response.actualValue !== "string" &&
          typeof response.actualValue !== "boolean")
      ) {
        return invalid("Invalid successful bridge response");
      }
      return {
        channelId: response.channelId,
        requestId: response.requestId,
        ok: true,
        actualValue: response.actualValue,
      };
    }
    if (
      !hasOnlyKeys(response, ["channelId", "requestId", "ok", "error"]) ||
      typeof response.error !== "string"
    ) {
      return invalid("Invalid failed bridge response");
    }
    return {
      channelId: response.channelId,
      requestId: response.requestId,
      ok: false,
      error: response.error,
    };
  },
};

export function parseSerializedRequest(value: unknown): BridgeRequest {
  if (typeof value !== "string" || value.length > 25_000) {
    return invalid("Invalid serialized bridge request");
  }
  return bridgeRequestSchema.parse(JSON.parse(value));
}

export function parseSerializedResponse(value: unknown): BridgeResponse {
  if (typeof value !== "string" || value.length > 25_000) {
    return invalid("Invalid serialized bridge response");
  }
  return bridgeResponseSchema.parse(JSON.parse(value));
}

export function isBridgeResponse(
  value: unknown,
  channelId: string,
  requestId: string,
): value is BridgeResponse {
  try {
    const response = bridgeResponseSchema.parse(value);
    return response.channelId === channelId && response.requestId === requestId;
  } catch {
    return false;
  }
}
