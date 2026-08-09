import type { AnswerMemory } from "@job-copilot/contracts";
import { useEffect, useState } from "react";

export interface MemoryProps {
  listMemories: () => Promise<AnswerMemory[]>;
}

function displayValue(value: AnswerMemory["value"]): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function Memory({ listMemories }: MemoryProps) {
  const [items, setItems] = useState<AnswerMemory[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    listMemories().then(
      (memories) => {
        if (!active) return;
        if (!Array.isArray(memories)) {
          setFailed(true);
          return;
        }
        setItems(memories);
      },
      () => active && setFailed(true),
    );
    return () => { active = false; };
  }, [listMemories]);

  return (
    <section className="job-copilot-section" aria-label="Memory">
      <h2>Memory</h2>
      {items.length === 0 && !failed && <p>No stored answers yet.</p>}
      <ul>
        {items.map((memory) => (
          <li key={memory.id}>
            <strong>{memory.normalizedQuestion}</strong>
            <small>{memory.scope === "global" ? "Global" : "Application-specific"}</small>
            <span>{displayValue(memory.value)}</span>
          </li>
        ))}
      </ul>
      {failed && <small role="alert">Could not load answer memory</small>}
    </section>
  );
}
