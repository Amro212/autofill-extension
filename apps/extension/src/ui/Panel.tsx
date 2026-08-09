import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
  AnswerMemory,
  AutomationSettings,
  AutomationSettingsUpdate,
  DocumentKind,
  DocumentMetadata,
  ResumeParseResult,
  RuntimeConfig,
} from "@job-copilot/contracts";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Documents } from "./Documents.js";
import { Memory } from "./Memory.js";
import { Profile } from "./Profile.js";
import { Settings } from "./Settings.js";

export interface PanelProps {
  checkHealth: () => Promise<unknown>;
  pairBackend: (pairingSecret: string) => Promise<unknown>;
  getProfile: () => Promise<ApplicantProfile>;
  updateProfile: (update: ApplicantProfileUpdate) => Promise<ApplicantProfile>;
  getSettings: () => Promise<AutomationSettings>;
  updateSettings: (
    update: AutomationSettingsUpdate,
  ) => Promise<AutomationSettings>;
  listDocuments: () => Promise<DocumentMetadata[]>;
  uploadDocument: (input: {
    file: File;
    kind: DocumentKind;
  }) => Promise<DocumentMetadata>;
  setDefaultDocument: (id: string) => Promise<DocumentMetadata>;
  parseResume?: (id: string) => Promise<ResumeParseResult>;
  listMemories?: () => Promise<AnswerMemory[]>;
  getRuntimeConfig?: () => Promise<RuntimeConfig>;
  generateResume?: (sourceDocumentId: string) => Promise<DocumentMetadata[]>;
  generateCoverLetter?: (sourceDocumentId: string) => Promise<DocumentMetadata[]>;
  contextStatus?:
    | { status: "matched"; label: string }
    | {
        status: "ambiguous";
        candidates: Array<{ jobId: string; label: string }>;
      };
  confirmJobContext?: (jobId: string) => Promise<unknown>;
  detectedFieldCount?: number;
  fillPage?: () => Promise<{ filled: number; failed: number }>;
  undoLast?: () => Promise<unknown>;
  scanPage?: () => Promise<unknown>;
  retryFailed?: () => Promise<unknown>;
  pauseResume?: () => Promise<unknown>;
  exportDebugBundle?: () => Promise<unknown>;
  applicationStatus?: {
    adapterId: string;
    sessionId?: string;
    state?: string;
    step: string;
    selectedDocuments: number;
  };
  debugStatus?: {
    fieldCount: number;
    recentActions: string[];
    errors: string[];
  };
}

type PanelState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "unpaired" }
  | {
      status: "ready";
      profile: ApplicantProfile;
      settings: AutomationSettings;
    };

type TabId = "status" | "profile" | "settings";

export function Panel(props: PanelProps) {
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [pairingSecret, setPairingSecret] = useState("");
  const [pairingError, setPairingError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [fillStatus, setFillStatus] = useState<
    | { state: "idle" }
    | { state: "generating" }
    | { state: "done"; filled: number; failed: number }
    | { state: "error" }
  >({ state: "idle" });

  const loadPrivateData = useCallback(async () => {
    try {
      const [profile, settings] = await Promise.all([
        props.getProfile(),
        props.getSettings(),
      ]);
      setState({ status: "ready", profile, settings });
      return true;
    } catch {
      setState({ status: "unpaired" });
      return false;
    }
  }, [props.getProfile, props.getSettings]);

  useEffect(() => {
    let active = true;
    props.checkHealth().then(
      async () => {
        if (active) await loadPrivateData();
      },
      () => active && setState({ status: "offline" }),
    );
    return () => {
      active = false;
    };
  }, [loadPrivateData, props.checkHealth]);

  async function pair(event: FormEvent) {
    event.preventDefault();
    setPairingError(false);
    setState({ status: "loading" });
    try {
      await props.pairBackend(pairingSecret);
      if (!(await loadPrivateData())) setPairingError(true);
    } catch {
      setPairingError(true);
      setState({ status: "unpaired" });
    }
  }

  return (
    <aside className="job-copilot-panel" aria-label="Job Copilot">
      <header>
        <strong>Job Copilot</strong>
        <span data-state={state.status}>{state.status}</span>
      </header>

      {state.status === "loading" && (
        <div className="jc-content">
          <p className="jc-generating">Connecting to local service…</p>
        </div>
      )}

      {state.status === "offline" && (
        <div className="jc-content">
          <p>Start the local Job Copilot service to get started.</p>
          <p style={{ fontSize: 11, color: "var(--jc-text-muted)" }}>
            Run <code>pnpm start:server</code> in your terminal.
          </p>
        </div>
      )}

      {state.status === "unpaired" && (
        <div className="jc-content">
          <form onSubmit={pair} className="job-copilot-section" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
            <h2>Pair with Backend</h2>
            <p style={{ margin: 0 }}>Enter the one-time secret from the local service.</p>
            <label>
              Pairing secret
              <input
                type="password"
                required
                value={pairingSecret}
                onChange={(event) => setPairingSecret(event.target.value)}
                placeholder="Paste secret here…"
              />
            </label>
            <button type="submit">Connect</button>
            {pairingError && <small role="alert">Pairing failed — check the secret and try again</small>}
          </form>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {/* Tab navigation */}
          <nav className="jc-tabs" role="tablist">
            {(["status", "profile", "settings"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                className="jc-tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "status" ? "Status" : tab === "profile" ? "Profile" : "Settings"}
              </button>
            ))}
          </nav>

          <div className="jc-content">
            {/* Context badge */}
            {props.contextStatus?.status === "matched" && (
              <p className="job-copilot-context" role="status">
                🎯 Job: {props.contextStatus.label}
              </p>
            )}
            {props.contextStatus?.status === "ambiguous" && (
              <div className="job-copilot-context" role="group" aria-label="Confirm job context">
                <span>Which job is this application for?</span>
                {props.contextStatus.candidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.jobId}
                    onClick={() => props.confirmJobContext?.(candidate.jobId)}
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
            )}

            {/* ─── Status Tab ─── */}
            {activeTab === "status" && (
              <>
                {/* Stats cards */}
                <div className="jc-stats" style={{ marginBottom: 12 }}>
                  <div className="jc-stat">
                    <div className="jc-stat-value">{props.detectedFieldCount ?? 0}</div>
                    <div className="jc-stat-label">Fields</div>
                  </div>
                  <div className="jc-stat">
                    <div className="jc-stat-value">
                      {fillStatus.state === "done" ? fillStatus.filled : 0}
                    </div>
                    <div className="jc-stat-label">Filled</div>
                  </div>
                  <div className="jc-stat">
                    <div className="jc-stat-value">
                      {fillStatus.state === "done" ? fillStatus.failed : 0}
                    </div>
                    <div className="jc-stat-label">Failed</div>
                  </div>
                  <div className="jc-stat">
                    <div className="jc-stat-value">
                      {props.applicationStatus?.selectedDocuments ?? 0}
                    </div>
                    <div className="jc-stat-label">Docs</div>
                  </div>
                </div>

                {/* Actions */}
                {(props.fillPage !== undefined ||
                  props.scanPage !== undefined ||
                  props.retryFailed !== undefined ||
                  props.pauseResume !== undefined ||
                  props.undoLast !== undefined) && (
                  <section className="job-copilot-section" aria-label="Actions" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                    <h2>Actions</h2>
                    <div className="jc-actions">
                      {props.fillPage !== undefined && (
                        <button
                          type="button"
                          className="jc-btn-primary"
                          disabled={
                            fillStatus.state === "generating" ||
                            (props.detectedFieldCount ?? 0) === 0
                          }
                          onClick={async () => {
                            setFillStatus({ state: "generating" });
                            try {
                              const result = await props.fillPage!();
                              setFillStatus({ state: "done", ...result });
                            } catch {
                              setFillStatus({ state: "error" });
                            }
                          }}
                        >
                          {fillStatus.state === "generating" ? (
                            <span className="jc-generating">Filling…</span>
                          ) : (
                            "⚡ Autofill"
                          )}
                        </button>
                      )}
                      {props.scanPage !== undefined && (
                        <button type="button" onClick={() => void props.scanPage?.()}>
                          Scan
                        </button>
                      )}
                    </div>
                    <div className="jc-actions">
                      {props.retryFailed !== undefined && (
                        <button type="button" onClick={() => void props.retryFailed?.()}>
                          Retry
                        </button>
                      )}
                      {props.pauseResume !== undefined && (
                        <button type="button" onClick={() => void props.pauseResume?.()}>
                          {props.applicationStatus?.state === "PAUSED" ? "Resume" : "Pause"}
                        </button>
                      )}
                      {props.undoLast !== undefined && (
                        <button type="button" onClick={() => void props.undoLast?.()}>
                          Undo
                        </button>
                      )}
                    </div>
                    {fillStatus.state === "done" && (
                      <small role="status">
                        ✓ Filled {fillStatus.filled} fields
                        {fillStatus.failed === 0 ? "" : ` · ${fillStatus.failed} failed`}
                      </small>
                    )}
                    {fillStatus.state === "error" && <small role="alert">AI fill failed</small>}
                  </section>
                )}

                {/* Application info */}
                {props.applicationStatus !== undefined && (
                  <section className="job-copilot-section" aria-label="Application">
                    <h2>Application</h2>
                    <dl>
                      <dt>ATS</dt><dd>{props.applicationStatus.adapterId}</dd>
                      <dt>State</dt>
                      <dd>
                        <span className={`jc-badge ${
                          props.applicationStatus.state === "SUBMITTED" ? "jc-badge--green" :
                          props.applicationStatus.state === "FAILED" ? "jc-badge--red" :
                          "jc-badge--amber"
                        }`}>
                          {props.applicationStatus.state ?? "DISCOVERED"}
                        </span>
                      </dd>
                    </dl>
                  </section>
                )}

                {/* Debug */}
                {props.debugStatus !== undefined && (
                  <section className="job-copilot-section" aria-label="Debug">
                    <h2>Debug</h2>
                    <dl>
                      <dt>Adapter</dt><dd>{props.applicationStatus?.adapterId ?? "generic"}</dd>
                      <dt>Session</dt><dd>{props.applicationStatus?.sessionId ?? "none"}</dd>
                      <dt>Fields</dt><dd>{props.debugStatus.fieldCount}</dd>
                    </dl>
                    {props.debugStatus.errors.length > 0 && (
                      <div className="jc-error-list">
                        {props.debugStatus.errors.map((error, i) => (
                          <span key={`${i}-${error}`} className="jc-error-tag">{error}</span>
                        ))}
                      </div>
                    )}
                    {props.exportDebugBundle !== undefined && (
                      <button type="button" onClick={() => void props.exportDebugBundle?.()}>
                        Export Debug Bundle
                      </button>
                    )}
                  </section>
                )}
              </>
            )}

            {/* ─── Profile Tab ─── */}
            {activeTab === "profile" && (
              <Profile
                profile={state.profile}
                onSave={async (update) => {
                  const profile = await props.updateProfile(update);
                  setState((current) =>
                    current.status === "ready" ? { ...current, profile } : current,
                  );
                  return profile;
                }}
              />
            )}

            {/* ─── Settings Tab ─── */}
            {activeTab === "settings" && (
              <>
                <Settings
                  settings={state.settings}
                  {...(props.getRuntimeConfig === undefined
                    ? {}
                    : { getRuntimeConfig: props.getRuntimeConfig })}
                  onSave={async (update) => {
                    const settings = await props.updateSettings(update);
                    setState((current) =>
                      current.status === "ready" ? { ...current, settings } : current,
                    );
                    return settings;
                  }}
                />
                <Documents
                  listDocuments={props.listDocuments}
                  uploadDocument={props.uploadDocument}
                  setDefaultDocument={props.setDefaultDocument}
                  {...(props.parseResume === undefined ? {} : { parseResume: props.parseResume })}
                  onProfileSuggestions={(suggestions: ApplicantProfileUpdate) => {
                    setState((current) => {
                      if (current.status !== "ready") return current;
                      return {
                        ...current,
                        profile: {
                          ...current.profile,
                          identity: { ...current.profile.identity, ...suggestions.identity },
                          contact: { ...current.profile.contact, ...suggestions.contact },
                          education: suggestions.education ?? current.profile.education,
                          employment: suggestions.employment ?? current.profile.employment,
                          projects: suggestions.projects ?? current.profile.projects,
                          skills: suggestions.skills ?? current.profile.skills,
                          certifications:
                            suggestions.certifications ?? current.profile.certifications,
                          eligibility: suggestions.eligibility ?? current.profile.eligibility,
                          preferences: {
                            ...current.profile.preferences,
                            ...suggestions.preferences,
                          },
                          customFacts: suggestions.customFacts ?? current.profile.customFacts,
                        },
                      };
                    });
                  }}
                  {...(props.generateResume === undefined
                    ? {}
                    : { generateResume: props.generateResume })}
                  {...(props.generateCoverLetter === undefined
                    ? {}
                    : { generateCoverLetter: props.generateCoverLetter })}
                />
                {props.listMemories !== undefined && <Memory listMemories={props.listMemories} />}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
