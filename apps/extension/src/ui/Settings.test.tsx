// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Settings } from "./Settings.js";

afterEach(cleanup);

describe("Settings", () => {
  it("shows the actual provider, model, retries, and document policy", async () => {
    render(
      <Settings
        settings={{
          userId: "local-user",
          aiAutofill: true,
          autoContinue: true,
          autoSubmit: false,
          autopilot: false,
          updatedAt: "2026-08-09T00:00:00.000Z",
        }}
        onSave={vi.fn()}
        getRuntimeConfig={async () => ({
          provider: "openrouter",
          model: "google/gemini-3.5-flash-lite",
          schemaRepairAttempts: 1,
          generationBehavior: "page-batch",
          documentPolicy: "reuse-generate-fallback",
        })}
      />,
    );

    expect(await screen.findByText("openrouter")).toBeInTheDocument();
    expect(screen.getByText("google/gemini-3.5-flash-lite")).toBeInTheDocument();
    expect(screen.getByText("Reuse, generate, then default fallback")).toBeInTheDocument();
  });
});
