import { useEffect, useState } from "react";

export interface ConnectionPanelProps {
  checkHealth: () => Promise<unknown>;
}

type ConnectionState = "checking" | "connected" | "offline";

export function ConnectionPanel({ checkHealth }: ConnectionPanelProps) {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    let active = true;
    checkHealth().then(
      () => active && setState("connected"),
      () => active && setState("offline"),
    );
    return () => {
      active = false;
    };
  }, [checkHealth]);

  return (
    <aside className="job-copilot-panel" aria-label="Job Copilot">
      <strong>Job Copilot</strong>
      <p>Backend: {state}</p>
    </aside>
  );
}
