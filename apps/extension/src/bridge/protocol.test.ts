import { describe, expect, it } from "vitest";

import {
  bridgeRequestSchema,
  bridgeResponseSchema,
  isBridgeResponse,
} from "./protocol.js";

describe("MAIN-world bridge protocol", () => {
  it("accepts only narrow, secret-free field actions", () => {
    expect(
      bridgeRequestSchema.parse({
        channelId: "0123456789abcdef0123456789abcdef",
        requestId: "request-1",
        action: {
          type: "set-value",
          targetId: "field-1",
          value: "Ada Lovelace",
        },
      }),
    ).toBeTruthy();

    expect(() =>
      bridgeRequestSchema.parse({
        channelId: "0123456789abcdef0123456789abcdef",
        requestId: "request-2",
        action: {
          type: "set-value",
          targetId: "field-1",
          value: "Ada",
          token: "must-not-cross",
        },
      }),
    ).toThrow();
    expect(() =>
      bridgeRequestSchema.parse({
        channelId: "0123456789abcdef0123456789abcdef",
        requestId: "request-3",
        action: { type: "fill-profile", profile: { name: "Ada" } },
      }),
    ).toThrow();
  });

  it("binds responses to both the channel and request", () => {
    const response = bridgeResponseSchema.parse({
      channelId: "0123456789abcdef0123456789abcdef",
      requestId: "request-1",
      ok: true,
      actualValue: "Ada",
    });
    expect(
      isBridgeResponse(
        response,
        "0123456789abcdef0123456789abcdef",
        "request-1",
      ),
    ).toBe(true);
    expect(
      isBridgeResponse(
        response,
        "ffffffffffffffffffffffffffffffff",
        "request-1",
      ),
    ).toBe(false);
  });
});
