import type {
  ApplicationCreate,
  ApplicationSession,
  ApplicationState,
} from "@job-copilot/contracts";

export interface SessionApi {
  createApplication: (input: ApplicationCreate) => Promise<ApplicationSession>;
  getApplication: (id: string) => Promise<ApplicationSession>;
  getApplicationByTab: (tabId: number) => Promise<ApplicationSession>;
  transitionApplication: (
    id: string,
    state: ApplicationState,
  ) => Promise<ApplicationSession>;
}

export interface TabSessionStore {
  get: (tabId: number) => Promise<string | null>;
  set: (tabId: number, applicationId: string) => Promise<void> | void;
}

export class SessionController {
  constructor(
    private readonly api: SessionApi,
    private readonly tabs: TabSessionStore,
  ) {}

  async start(input: ApplicationCreate): Promise<ApplicationSession> {
    const created = await this.api.createApplication(input);
    const session =
      created.state === "DISCOVERED"
        ? await this.api.transitionApplication(created.id, "APPLICATION_LINKED")
        : created;
    const tabIds = new Set(session.activeTabIds ?? []);
    if (session.originatingTabId !== undefined) tabIds.add(session.originatingTabId);
    await Promise.all([...tabIds].map((tabId) => this.tabs.set(tabId, session.id)));
    return session;
  }

  async recover(tabId: number): Promise<ApplicationSession> {
    const applicationId = await this.tabs.get(tabId);
    const session =
      applicationId === null
        ? await this.api.getApplicationByTab(tabId)
        : await this.api.getApplication(applicationId);
    await this.tabs.set(tabId, session.id);
    return session;
  }
}
