// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  parseSerializedResponse,
} from "./protocol.js";
import { installMainWorldBridge } from "./main-world.js";

describe("MAIN-world field action handler", () => {
  it("mutates only the marked target and returns actual state", () => {
    const script = document.createElement("script");
    const input = document.createElement("input");
    input.dataset.jobCopilotTarget = "field-1";
    document.body.append(script, input);
    const stop = installMainWorldBridge(
      script,
      "0123456789abcdef0123456789abcdef",
    );
    let response: unknown;
    script.addEventListener(BRIDGE_RESPONSE_EVENT, (event) => {
      response = parseSerializedResponse((event as CustomEvent).detail);
    });

    script.dispatchEvent(
      new CustomEvent(BRIDGE_REQUEST_EVENT, {
        detail: JSON.stringify({
          channelId: "0123456789abcdef0123456789abcdef",
          requestId: "request-1",
          action: { type: "set-value", targetId: "field-1", value: "Ada" },
        }),
      }),
    );

    expect(input.value).toBe("Ada");
    expect(response).toMatchObject({ ok: true, actualValue: "Ada" });
    stop();
  });

  it("ignores requests for a different channel", () => {
    const script = document.createElement("script");
    document.body.append(script);
    const stop = installMainWorldBridge(
      script,
      "0123456789abcdef0123456789abcdef",
    );
    let responses = 0;
    script.addEventListener(BRIDGE_RESPONSE_EVENT, () => responses++);

    script.dispatchEvent(
      new CustomEvent(BRIDGE_REQUEST_EVENT, {
        detail: JSON.stringify({
          channelId: "ffffffffffffffffffffffffffffffff",
          requestId: "request-1",
          action: { type: "set-content", targetId: "field-1", value: "No" },
        }),
      }),
    );

    expect(responses).toBe(0);
    stop();
  });
});
