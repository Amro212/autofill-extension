import type {
  AutomationSettings,
  AutomationSettingsUpdate,
  RuntimeConfig,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useState } from "react";

export interface SettingsProps {
  settings: AutomationSettings;
  getRuntimeConfig?: () => Promise<RuntimeConfig>;
  onSave: (update: AutomationSettingsUpdate) => Promise<AutomationSettings>;
}

export function Settings({ settings, getRuntimeConfig, onSave }: SettingsProps) {
  const [autopilot, setAutopilot] = useState(settings.autopilot);
  const [autoContinue, setAutoContinue] = useState(settings.autoContinue);
  const [autoSubmit, setAutoSubmit] = useState(settings.autoSubmit);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();

  useEffect(() => {
    if (getRuntimeConfig === undefined) return;
    let active = true;
    getRuntimeConfig().then(
      (config) => active && setRuntimeConfig(config),
      () => {},
    );
    return () => { active = false; };
  }, [getRuntimeConfig]);

  useEffect(() => {
    setAutopilot(settings.autopilot);
    setAutoContinue(settings.autoContinue);
    setAutoSubmit(settings.autoSubmit);
  }, [settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await onSave({ autopilot, autoContinue, autoSubmit });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="job-copilot-section">
      <h2>Automation</h2>

      <label className="jc-switch">
        <input
          type="checkbox"
          checked={autopilot}
          onChange={(event) => setAutopilot(event.target.checked)}
        />
        Autopilot mode
      </label>

      <label className="jc-switch">
        <input
          type="checkbox"
          checked={autoContinue}
          onChange={(event) => setAutoContinue(event.target.checked)}
        />
        Auto-advance pages
      </label>

      <label className="jc-switch">
        <input
          type="checkbox"
          checked={autoSubmit}
          onChange={(event) => setAutoSubmit(event.target.checked)}
        />
        Auto-submit application
      </label>

      <button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save settings"}
      </button>
      {status === "saved" && <small role="status">✓ Settings saved</small>}
      {status === "error" && <small role="alert">Could not save settings</small>}

      {runtimeConfig !== undefined && (
        <div className="jc-profile-summary" style={{ marginTop: 4 }}>
          <h4>Runtime</h4>
          <dl>
            <dt>Provider</dt><dd>{runtimeConfig.provider ?? "mock"}</dd>
            <dt>Model</dt><dd>{runtimeConfig.model ?? "—"}</dd>
          </dl>
        </div>
      )}
    </form>
  );
}
