import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { PairingService } from "../src/auth/pairing.js";
import { isMainModule, resolveServerConfig } from "../src/server.js";

const openApps: Array<ReturnType<typeof buildApp>> = [];

function createApp() {
  const app = buildApp({
    logger: false,
    pairingService: new PairingService({
      installationId: "installation-1",
      pairingSecret: "correct-horse-battery-staple",
    }),
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("health and server binding", () => {
  it("serves health without authentication", async () => {
    const response = await createApp().inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("serves health over an actual loopback socket", async () => {
    const app = createApp();
    await app.listen({ host: "127.0.0.1", port: 0 });

    const response = await fetch(`${app.listeningOrigin}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("defaults to an IPv4 loopback binding", () => {
    expect(resolveServerConfig({})).toEqual({ host: "127.0.0.1", port: 4317 });
  });

  it("recognizes a Windows entrypoint file URL", () => {
    expect(
      isMainModule(
        "C:\\job-copilot\\dist\\src\\server.js",
        "file:///C:/job-copilot/dist/src/server.js",
      ),
    ).toBe(true);
  });
});

describe("protected API", () => {
  it("rejects an unpaired request", async () => {
    const response = await createApp().inject({
      method: "GET",
      url: "/v1/auth/status",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("BACKEND_UNPAIRED");
  });

  it("accepts a token returned by explicit pairing", async () => {
    const app = createApp();
    const pairing = await app.inject({
      method: "POST",
      url: "/v1/pair",
      payload: { pairingSecret: "correct-horse-battery-staple" },
    });

    expect(pairing.statusCode).toBe(200);
    const body = pairing.json<{ installationId: string; token: string }>();
    expect(body.installationId).toBe("installation-1");
    expect(body.token).not.toBe("correct-horse-battery-staple");

    const protectedResponse = await app.inject({
      method: "GET",
      url: "/v1/auth/status",
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(protectedResponse.statusCode).toBe(200);
    expect(protectedResponse.json()).toEqual({ paired: true });
  });

  it("rejects requests from an untrusted web origin", async () => {
    const response = await createApp().inject({
      method: "POST",
      url: "/v1/pair",
      headers: { origin: "https://malicious.example" },
      payload: { pairingSecret: "correct-horse-battery-staple" },
    });

    expect(response.statusCode).toBe(403);
  });
});
