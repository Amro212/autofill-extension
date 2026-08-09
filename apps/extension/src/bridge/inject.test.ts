// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createBridgeClient } from "./inject.js";
import { installMainWorldBridge } from "./main-world.js";

describe("isolated-to-MAIN bridge client", () => {
  it("round-trips only a field action and disposes cleanly", async () => {
    const script = document.createElement("script");
    const input = document.createElement("input");
    input.dataset.jobCopilotTarget = "target-1";
    document.body.append(script, input);
    const channelId = "0123456789abcdef0123456789abcdef";
    const stopMain = installMainWorldBridge(script, channelId);
    const client = createBridgeClient(script, channelId);

    await expect(
      client.execute({ type: "set-value", targetId: "target-1", value: "Ada" }),
    ).resolves.toMatchObject({ ok: true, actualValue: "Ada" });
    expect(input.value).toBe("Ada");

    client.dispose();
    await expect(
      client.execute({ type: "set-value", targetId: "target-1", value: "Grace" }),
    ).rejects.toThrow("bridge-disposed");
    stopMain();
  });
});
