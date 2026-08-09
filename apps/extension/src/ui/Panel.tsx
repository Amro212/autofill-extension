import type {
  ApplicantProfile,
  ApplicantProfileUpdate,
  AutomationSettings,
  AutomationSettingsUpdate,
  DocumentKind,
  DocumentMetadata,
} from "@job-copilot/contracts";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Documents } from "./Documents.js";
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
          {props.fillPage !== undefined && (
            <section className="job-copilot-section" aria-label="AI Autofill">
              <h2>AI Autofill</h2>
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
                  : `Fill ${props.detectedFieldCount ?? 0} fields`}
              </button>
              {fillStatus.state === "done" && (
                <>
                  <small role="status">
                    Filled {fillStatus.filled} fields
                    {fillStatus.failed === 0 ? "" : ` · ${fillStatus.failed} failed`}
                  </small>
                  {props.undoLast !== undefined && (
                    <button type="button" onClick={() => void props.undoLast?.()}>
                      Undo last fill
                    </button>
                  )}
                </>
              )}
              {fillStatus.state === "error" && (
                <small role="alert">AI fill failed</small>
              )}
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
          />
        </>
      )}
    </aside>
  );
}
