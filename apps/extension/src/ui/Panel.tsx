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
