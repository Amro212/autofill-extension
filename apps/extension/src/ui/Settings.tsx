import type {
  AutomationSettings,
  AutomationSettingsUpdate,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useState } from "react";

export interface SettingsProps {
  settings: AutomationSettings;
  onSave: (update: AutomationSettingsUpdate) => Promise<AutomationSettings>;
}

const toggleLabels = {
  aiAutofill: "AI Autofill",
  autoContinue: "Auto Continue",
  autoSubmit: "Auto Submit",
  autopilot: "Autopilot",
} as const;

export function Settings({ settings, onSave }: SettingsProps) {
  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  useEffect(() => setDraft(settings), [settings]);

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
      <button type="submit" disabled={status === "saving"}>Save settings</button>
      {status === "saved" && <small role="status">Settings saved</small>}
      {status === "error" && <small role="alert">Could not save settings</small>}
    </form>
  );
}

