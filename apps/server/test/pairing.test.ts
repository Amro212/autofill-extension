import { describe, expect, it } from "vitest";

import { PairingService } from "../src/auth/pairing.js";

describe("PairingService", () => {
  it("rejects an incorrect pairing secret", () => {
    const service = new PairingService({
      installationId: "installation-1",
      pairingSecret: "setup-secret",
    });

    expect(() => service.pair("wrong-secret")).toThrow("Invalid pairing secret");
  });

  it("verifies only the issued bearer token", () => {
    const service = new PairingService({
      installationId: "installation-1",
      pairingSecret: "setup-secret",
    });

    const result = service.pair("setup-secret");

    expect(service.verifyToken(result.token)).toBe(true);
    expect(service.verifyToken("different-token")).toBe(false);
    expect(service.verifyToken("setup-secret")).toBe(false);
  });
});
