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

  it("uploads a document as bounded multipart data with metadata before bytes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ id: "document-1", originalFilename: "resume.pdf" }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.uploadDocument({
      bytes: new Blob(["%PDF-test"], { type: "application/pdf" }),
      filename: "resume.pdf",
      kind: "resume",
    });

    const init = fetcher.mock.calls[0]![1]!;
    expect(init.headers).toEqual({ authorization: "Bearer paired-token" });
    expect(init.body).toBeInstanceOf(FormData);
    const entries = [...(init.body as FormData).entries()];
    expect(entries[0]).toEqual(["kind", "resume"]);
    expect(entries[1]?.[0]).toBe("file");
  });

  it("captures a job and starts a tab-linked application session", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "job-1", title: "Engineer" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "application-1", state: "DISCOVERED" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.captureJob({ title: "Engineer" });
    await client.createApplication({
      jobId: "job-1",
      originatingTabId: 1,
      activeTabIds: [1, 2],
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:4317/v1/jobs",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:4317/v1/applications",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
