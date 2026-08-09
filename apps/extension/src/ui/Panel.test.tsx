// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicantProfile, AutomationSettings } from "@job-copilot/contracts";
import { Panel } from "./Panel.js";

const profile: ApplicantProfile = {
  id: "profile-1",
  userId: "local-user",
  identity: { firstName: "Ada", lastName: "Lovelace" },
  contact: { email: "ada@example.test" },
  education: [],
  employment: [],
  projects: [],
  skills: [],
  certifications: [],
  eligibility: {},
  preferences: {},
  customFacts: {},
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const settings: AutomationSettings = {
  userId: "local-user",
  aiAutofill: true,
  autoContinue: true,
  autoSubmit: false,
  autopilot: false,
  updatedAt: "2026-08-08T12:00:00.000Z",
};

afterEach(cleanup);

describe("Panel", () => {
  it("loads and edits profile data through the extension API boundary", async () => {
    const updateProfile = vi.fn().mockResolvedValue(profile);
    render(
      <Panel
        checkHealth={async () => ({ status: "ok" })}
        pairBackend={vi.fn()}
        getProfile={async () => profile}
        updateProfile={updateProfile}
        getSettings={async () => settings}
        updateSettings={vi.fn()}
        listDocuments={async () => []}
        uploadDocument={vi.fn()}
        setDefaultDocument={vi.fn()}
      />,
    );

    const firstName = await screen.findByLabelText("First name");
    fireEvent.change(firstName, { target: { value: "Grace" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        identity: { firstName: "Grace", lastName: "Lovelace" },
        contact: { email: "ada@example.test" },
      }),
    );
  });

  it("shows locked defaults and persists a changed automation toggle", async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...settings,
      autoSubmit: true,
    });
    render(
      <Panel
        checkHealth={async () => ({ status: "ok" })}
        pairBackend={vi.fn()}
        getProfile={async () => profile}
        updateProfile={vi.fn()}
        getSettings={async () => settings}
        updateSettings={updateSettings}
        listDocuments={async () => []}
        uploadDocument={vi.fn()}
        setDefaultDocument={vi.fn()}
      />,
    );

    const autoSubmit = await screen.findByLabelText("Auto Submit");
    expect(autoSubmit).not.toBeChecked();
    fireEvent.click(autoSubmit);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoSubmit: true }),
      ),
    );
  });

  it("accepts the one-time pairing secret before loading private data", async () => {
    const getProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("Pair extension before continuing"))
      .mockResolvedValue(profile);
    const pairBackend = vi.fn().mockResolvedValue({
      installationId: "installation-1",
      token: "paired-token",
    });
    render(
      <Panel
        checkHealth={async () => ({ status: "ok" })}
        pairBackend={pairBackend}
        getProfile={getProfile}
        updateProfile={vi.fn()}
        getSettings={async () => settings}
        updateSettings={vi.fn()}
        listDocuments={async () => []}
        uploadDocument={vi.fn()}
        setDefaultDocument={vi.fn()}
      />,
    );

    const secret = await screen.findByLabelText("Pairing secret");
    fireEvent.change(secret, { target: { value: "one-time-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Pair service" }));

    await waitFor(() => expect(pairBackend).toHaveBeenCalledWith("one-time-secret"));
    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
  });

  it("surfaces ambiguous job context as one compact confirmation", async () => {
    const confirmJobContext = vi.fn().mockResolvedValue(undefined);
    render(
      <Panel
        checkHealth={async () => ({ status: "ok" })}
        pairBackend={vi.fn()}
        getProfile={async () => profile}
        updateProfile={vi.fn()}
        getSettings={async () => settings}
        updateSettings={vi.fn()}
        listDocuments={async () => []}
        uploadDocument={vi.fn()}
        setDefaultDocument={vi.fn()}
        contextStatus={{
          status: "ambiguous",
          candidates: [
            { jobId: "job-1", label: "Engineer · Example Corp" },
            { jobId: "job-2", label: "Designer · Example Corp" },
          ],
        }}
        confirmJobContext={confirmJobContext}
      />,
    );

    expect(await screen.findByText("Which captured job is this for?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Engineer · Example Corp" }));
    await waitFor(() => expect(confirmJobContext).toHaveBeenCalledWith("job-1"));
  });
});
