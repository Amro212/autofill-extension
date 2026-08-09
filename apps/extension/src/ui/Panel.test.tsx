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
    await waitFor(() => expect(autoSubmit).toBeChecked());
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

  it("fills all detected fields in one page action and exposes undo", async () => {
    const fillPage = vi.fn().mockResolvedValue({ filled: 2, failed: 0 });
    const undoLast = vi.fn().mockResolvedValue({ ok: true });
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
        detectedFieldCount={2}
        fillPage={fillPage}
        undoLast={undoLast}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Autofill Application" }));
    expect(await screen.findByText("Filled 2 fields")).toBeInTheDocument();
    expect(fillPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(undoLast).toHaveBeenCalledTimes(1));
  });

  it("shows operational application actions and exports a debug bundle", async () => {
    const scanPage = vi.fn().mockResolvedValue(undefined);
    const retryFailed = vi.fn().mockResolvedValue({ filled: 1, failed: 0 });
    const pauseResume = vi.fn().mockResolvedValue(undefined);
    const exportDebugBundle = vi.fn().mockResolvedValue(undefined);
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
        detectedFieldCount={4}
        applicationStatus={{
          adapterId: "greenhouse",
          sessionId: "application-1",
          state: "FILLING",
          step: "greenhouse-application",
          selectedDocuments: 1,
        }}
        debugStatus={{
          fieldCount: 4,
          recentActions: ["scan", "field-action"],
          errors: ["FIELD_VERIFICATION_FAILED"],
        }}
        scanPage={scanPage}
        retryFailed={retryFailed}
        pauseResume={pauseResume}
        exportDebugBundle={exportDebugBundle}
      />,
    );

    expect((await screen.findAllByText("greenhouse")).length).toBeGreaterThan(0);
    expect(screen.getByText("application-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scan" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry Failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Debug Bundle" }));

    await waitFor(() => {
      expect(scanPage).toHaveBeenCalledTimes(1);
      expect(retryFailed).toHaveBeenCalledTimes(1);
      expect(pauseResume).toHaveBeenCalledTimes(1);
      expect(exportDebugBundle).toHaveBeenCalledTimes(1);
    });
  });
});
