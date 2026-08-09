import { describe, expect, it, vi } from "vitest";

import { createBackendClient } from "./client.js";

describe("backend client", () => {
  it("reads public health without an authorization header", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({ fetcher, getToken: async () => null });

    await expect(client.health()).resolves.toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/health",
      expect.not.objectContaining({
        headers: expect.objectContaining({ authorization: expect.anything() }),
      }),
    );
  });

  it("adds the paired token to protected requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ paired: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await expect(client.authStatus()).resolves.toEqual({ paired: true });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/auth/status",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer paired-token",
        }),
      }),
    );
  });

  it("stores a token returned by pairing", async () => {
    const saveToken = vi.fn<(token: string) => Promise<void>>();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ installationId: "installation-1", token: "new-token" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => null,
      saveToken,
    });

    await client.pair("setup-secret");

    expect(saveToken).toHaveBeenCalledWith("new-token");
  });

  it("reads and updates profile through authenticated JSON requests", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ identity: { firstName: "Ada" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ identity: { firstName: "Grace" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.getProfile();
    await client.updateProfile({ identity: { firstName: "Grace" } });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4317/v1/profile",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer paired-token" }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4317/v1/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ identity: { firstName: "Grace" } }),
      }),
    );
  });

  it("updates automation settings through an authenticated PATCH", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ autoSubmit: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.updateSettings({ autoSubmit: true });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/settings",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
