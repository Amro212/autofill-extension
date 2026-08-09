import type {
  AutomationSettings,
  AutomationSettingsUpdate,
  RuntimeConfig,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useState } from "react";

export interface SettingsProps {
  settings: AutomationSettings;
  onSave: (update: AutomationSettingsUpdate) => Promise<AutomationSettings>;
  getRuntimeConfig?: () => Promise<RuntimeConfig>;
}

const toggleLabels = {
  aiAutofill: "AI Autofill",
  autoContinue: "Auto Continue",
  autoSubmit: "Auto Submit",
  autopilot: "Autopilot",
} as const;

export function Settings({ settings, onSave, getRuntimeConfig }: SettingsProps) {
  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  useEffect(() => setDraft(settings), [settings]);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();
  useEffect(() => {
    let active = true;
    getRuntimeConfig?.().then((config) => { if (active) setRuntimeConfig(config); });
    return () => { active = false; };
  }, [getRuntimeConfig]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      const saved = await onSave({
        aiAutofill: draft.aiAutofill,
        autoContinue: draft.autoContinue,
        autoSubmit: draft.autoSubmit,
        autopilot: draft.autopilot,
      });
      setDraft(saved);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={submit} className="job-copilot-section">
      <h2>Automation</h2>
      {Object.entries(toggleLabels).map(([key, label]) => {
        const setting = key as keyof typeof toggleLabels;
        return (
          <label className="job-copilot-toggle" key={setting}>
            <input
              type="checkbox"
              checked={draft[setting]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [setting]: event.target.checked,
                }))
              }
            />
            {label}
          </label>
        );
      })}
      <h3>AI and documents</h3>
      <dl>
        <dt>Provider</dt><dd>{runtimeConfig?.provider ?? "Loading…"}</dd>
        <dt>Model</dt><dd>{runtimeConfig?.model ?? "Loading…"}</dd>
        <dt>Generation</dt><dd>One page batch</dd>
        <dt>Schema repair retries</dt><dd>{runtimeConfig?.schemaRepairAttempts ?? "Loading…"}</dd>
        <dt>Document policy</dt><dd>Reuse, generate, then default fallback</dd>
      </dl>
      <button type="submit" disabled={status === "saving"}>Save settings</button>
      {status === "saved" && <small role="status">Settings saved</small>}
      {status === "error" && <small role="alert">Could not save settings</small>}
    </form>
  );
}
