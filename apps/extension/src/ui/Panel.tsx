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

export function Panel(props: PanelProps) {
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [pairingSecret, setPairingSecret] = useState("");
  const [pairingError, setPairingError] = useState(false);
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
      {props.contextStatus?.status === "matched" && (
        <p className="job-copilot-context" role="status">
          Job: {props.contextStatus.label}
        </p>
      )}
      {props.contextStatus?.status === "ambiguous" && (
        <div className="job-copilot-context" role="group" aria-label="Confirm job context">
          <span>Which captured job is this for?</span>
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
      {state.status === "loading" && <p>Connecting…</p>}
      {state.status === "offline" && <p>Start the local Job Copilot service.</p>}
      {state.status === "unpaired" && (
        <form onSubmit={pair} className="job-copilot-section">
          <p>Enter the one-time secret printed by the local service.</p>
          <label>
            Pairing secret
            <input
              type="password"
              required
              value={pairingSecret}
              onChange={(event) => setPairingSecret(event.target.value)}
            />
          </label>
          <button type="submit">Pair service</button>
          {pairingError && <small role="alert">Pairing failed</small>}
        </form>
      )}
      {state.status === "ready" && (
        <>
          {props.applicationStatus !== undefined && (
            <section className="job-copilot-section" aria-label="Application">
              <h2>Application</h2>
              <dl>
                <dt>ATS</dt><dd>{props.applicationStatus.adapterId}</dd>
                <dt>State</dt><dd>{props.applicationStatus.state ?? "DISCOVERED"}</dd>
                <dt>Current step</dt><dd>{props.applicationStatus.step}</dd>
                <dt>Detected fields</dt><dd>{props.detectedFieldCount ?? 0}</dd>
                <dt>Filled fields</dt>
                <dd>{fillStatus.state === "done" ? fillStatus.filled : 0}</dd>
                <dt>Failures</dt>
                <dd>{fillStatus.state === "done" ? fillStatus.failed : 0}</dd>
                <dt>Selected documents</dt><dd>{props.applicationStatus.selectedDocuments}</dd>
              </dl>
            </section>
          )}
          {(props.fillPage !== undefined ||
            props.scanPage !== undefined ||
            props.retryFailed !== undefined ||
            props.pauseResume !== undefined ||
            props.undoLast !== undefined) && (
            <section className="job-copilot-section" aria-label="Actions">
              <h2>Actions</h2>
              {props.fillPage !== undefined && (
                <button
                  type="button"
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
                  {fillStatus.state === "generating"
                    ? "Generating…"
                    : "Autofill Application"}
                </button>
              )}
              {props.scanPage !== undefined && (
                <button type="button" onClick={() => void props.scanPage?.()}>Scan</button>
              )}
              {props.retryFailed !== undefined && (
                <button type="button" onClick={() => void props.retryFailed?.()}>
                  Retry Failed
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
              {fillStatus.state === "done" && (
                <small role="status">
                  Filled {fillStatus.filled} fields
                  {fillStatus.failed === 0 ? "" : ` · ${fillStatus.failed} failed`}
                </small>
              )}
              {fillStatus.state === "error" && <small role="alert">AI fill failed</small>}
            </section>
          )}
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
          />
          {props.listMemories !== undefined && <Memory listMemories={props.listMemories} />}
          {props.debugStatus !== undefined && (
            <section className="job-copilot-section" aria-label="Debug">
              <h2>Debug</h2>
              <dl>
                <dt>Adapter</dt><dd>{props.applicationStatus?.adapterId ?? "generic"}</dd>
                <dt>Session ID</dt><dd>{props.applicationStatus?.sessionId ?? "none"}</dd>
                <dt>Field registry</dt><dd>{props.debugStatus.fieldCount}</dd>
              </dl>
              <h3>Recent actions</h3>
              <ul>
                {props.debugStatus.recentActions.map((action, index) => (
                  <li key={`${index}-${action}`}>{action}</li>
                ))}
              </ul>
              <h3>Errors</h3>
              {props.debugStatus.errors.length === 0 ? (
                <p>None</p>
              ) : (
                <ul>
                  {props.debugStatus.errors.map((error, index) => (
                    <li key={`${index}-${error}`}>{error}</li>
                  ))}
                </ul>
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
    </aside>
  );
}
