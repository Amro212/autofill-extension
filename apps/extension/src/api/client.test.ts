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

  it("selects an application-aware document before upload", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "document-1", kind: "resume" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.selectApplicationDocument("application-1", "resume");

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/applications/application-1/documents/select",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ kind: "resume" }),
      }),
    );
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

  it("sends one authenticated AI request for the whole page", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ answers: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });
    const fields = [
      {
        id: "name",
        adapterId: "generic",
        pageKey: "apply",
        kind: "text" as const,
        label: "Name",
        required: true,
        currentValue: "",
        evidence: { labelFor: true },
        confidence: 0.9,
      },
    ];

    await client.answerPage({ pageKey: "apply", fields });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/ai/pages/answer",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer paired-token" }),
        body: JSON.stringify({ pageKey: "apply", fields }),
      }),
    );
  });

  it("persists an application state transition through an authenticated PATCH", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "application-1", state: "SCANNING" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    await client.transitionApplication("application-1", "SCANNING");

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/applications/application-1/state",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ authorization: "Bearer paired-token" }),
        body: JSON.stringify({ state: "SCANNING" }),
      }),
    );
  });

  it("downloads authenticated document bytes and preserves server metadata", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": "attachment; filename*=UTF-8''Ada%20Resume.pdf",
        },
      }),
    );
    const client = createBackendClient({
      fetcher,
      getToken: async () => "paired-token",
    });

    const document = await client.getDocumentContent("document-1");

    expect(new Uint8Array(document.bytes)).toEqual(bytes);
    expect(document).toMatchObject({
      filename: "Ada Resume.pdf",
      mediaType: "application/pdf",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/documents/document-1/content",
      expect.objectContaining({
        headers: { authorization: "Bearer paired-token" },
      }),
    );
  });

  it("parses a resume through the authenticated document API", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: "Ada", canonical: {}, profileSuggestions: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = createBackendClient({ fetcher, getToken: async () => "token" });

    await client.parseResume("document 1");

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:4317/v1/documents/document%201/parse",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer token" }),
      }),
    );
  });
});
