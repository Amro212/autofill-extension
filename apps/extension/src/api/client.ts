import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
  ApplicationCreate,
  ApplicationSession,
  ApplicationState,
  AutomationSettings,
  AutomationSettingsUpdate,
  DocumentKind,
  DocumentMediaType,
  DocumentMetadata,
  JobCapture,
  JobRecord,
  PageAnswerRequest,
  PageAnswerResult,
  RewriteRequest,
  RewriteResult,
} from "@job-copilot/contracts";

export interface BackendClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  getToken: () => Promise<string | null>;
  saveToken?: (token: string) => Promise<void>;
}

interface RequestOptions {
  authenticated?: boolean;
  body?: unknown;
  method?: "GET" | "PATCH" | "POST" | "PUT";
}

export function createBackendClient(options: BackendClientOptions) {
  const baseUrl = options.baseUrl ?? "http://127.0.0.1:4317";
  const fetcher = options.fetcher ?? fetch;

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (requestOptions.body !== undefined) headers["content-type"] = "application/json";
    if (requestOptions.authenticated) {
      const token = await options.getToken();
      if (token !== null) headers.authorization = `Bearer ${token}`;
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      method: requestOptions.method ?? "GET",
      headers,
      ...(requestOptions.body === undefined
        ? {}
        : { body: JSON.stringify(requestOptions.body) }),
    });
    const body = (await response.json()) as T & {
      error?: { code: string; message: string };
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? `Backend request failed (${response.status})`);
    }
    return body;
  }

  function documentFilename(disposition: string | null): string {
    const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    if (encoded === undefined) return "document";
    try {
      return decodeURIComponent(encoded);
    } catch {
      return "document";
    }
  }

  return {
    health: () => request<{ status: "ok" }>("/health"),
    authStatus: () =>
      request<{ paired: true }>("/v1/auth/status", { authenticated: true }),
    async pair(pairingSecret: string) {
      const result = await request<{ installationId: string; token: string }>(
        "/v1/pair",
        { method: "POST", body: { pairingSecret } },
      );
      await options.saveToken?.(result.token);
      return result;
    },
    getProfile: () =>
      request<ApplicantProfile>("/v1/profile", { authenticated: true }),
    updateProfile: (profile: ApplicantProfileUpdate) =>
      request<ApplicantProfile>("/v1/profile", {
        authenticated: true,
        method: "PATCH",
        body: profile,
      }),
    getSettings: () =>
      request<AutomationSettings>("/v1/settings", { authenticated: true }),
    updateSettings: (settings: AutomationSettingsUpdate) =>
      request<AutomationSettings>("/v1/settings", {
        authenticated: true,
        method: "PATCH",
        body: settings,
      }),
    getDocuments: () =>
      request<DocumentMetadata[]>("/v1/documents", { authenticated: true }),
    selectApplicationDocument: (applicationId: string, kind: DocumentKind) =>
      request<DocumentMetadata>(
        `/v1/applications/${encodeURIComponent(applicationId)}/documents/select`,
        { authenticated: true, method: "POST", body: { kind } },
      ),
    async getDocumentContent(id: string): Promise<{
      bytes: ArrayBuffer;
      filename: string;
      mediaType: DocumentMediaType;
    }> {
      const token = await options.getToken();
      const headers: Record<string, string> = {};
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const response = await fetcher(
        `${baseUrl}/v1/documents/${encodeURIComponent(id)}/content`,
        { method: "GET", headers },
      );
      if (!response.ok) throw new Error(`Document download failed (${response.status})`);
      const mediaType = response.headers.get("content-type");
      if (
        mediaType !== "application/pdf" &&
        mediaType !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        throw new Error("Document download returned an unsupported content type");
      }
      return {
        bytes: await response.arrayBuffer(),
        filename: documentFilename(response.headers.get("content-disposition")),
        mediaType,
      };
    },
    setDefaultDocument: (id: string) =>
      request<DocumentMetadata>(`/v1/documents/${id}/default`, {
        authenticated: true,
        method: "PUT",
      }),
    async uploadDocument(input: {
      bytes: Blob;
      filename: string;
      kind: DocumentKind;
    }) {
      const token = await options.getToken();
      const headers: Record<string, string> = {};
      if (token !== null) headers.authorization = `Bearer ${token}`;
      const body = new FormData();
      body.set("kind", input.kind);
      body.set("file", input.bytes, input.filename);
      const response = await fetcher(`${baseUrl}/v1/documents`, {
        method: "POST",
        headers,
        body,
      });
      const result = (await response.json()) as DocumentMetadata & {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "Document upload failed");
      }
      return result;
    },
    captureJob: (job: JobCapture) =>
      request<JobRecord>("/v1/jobs", {
        authenticated: true,
        method: "POST",
        body: job,
      }),
    createApplication: (application: ApplicationCreate) =>
      request<ApplicationSession>("/v1/applications", {
        authenticated: true,
        method: "POST",
        body: application,
      }),
    getApplication: (id: string) =>
      request<ApplicationSession>(`/v1/applications/${id}`, {
        authenticated: true,
      }),
    getApplicationByTab: (tabId: number) =>
      request<ApplicationSession>(`/v1/applications/by-tab/${tabId}`, {
        authenticated: true,
      }),
    transitionApplication: (id: string, state: ApplicationState) =>
      request<ApplicationSession>(`/v1/applications/${encodeURIComponent(id)}/state`, {
        authenticated: true,
        method: "PATCH",
        body: { state },
      }),
    answerPage: (input: PageAnswerRequest) =>
      request<PageAnswerResult>("/v1/ai/pages/answer", {
        authenticated: true,
        method: "POST",
        body: input,
      }),
    rewriteField: (input: RewriteRequest) =>
      request<RewriteResult>("/v1/ai/fields/rewrite", {
        authenticated: true,
        method: "POST",
        body: input,
      }),
  };
}
