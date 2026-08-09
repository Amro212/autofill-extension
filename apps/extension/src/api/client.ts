import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
  AutomationSettings,
  AutomationSettingsUpdate,
  DocumentKind,
  DocumentMetadata,
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
  };
}
