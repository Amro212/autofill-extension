import { describe, expect, it, vi } from "vitest";

import type { ApplicationSession } from "@job-copilot/contracts";
import { SessionController } from "./controller.js";

const session: ApplicationSession = {
  id: "application-1",
  userId: "local-user",
  jobId: "job-1",
  state: "DISCOVERED",
  originatingTabId: 10,
  activeTabIds: [10, 20],
  createdAt: "2026-08-09T01:00:00.000Z",
  updatedAt: "2026-08-09T01:00:00.000Z",
  aiAutofill: true,
  autoContinue: true,
  autoSubmit: false,
  autopilot: false,
};

describe("SessionController", () => {
  it("persists every linked tab when starting a correlated session", async () => {
    const set = vi.fn();
    const controller = new SessionController(
      {
        createApplication: vi.fn().mockResolvedValue(session),
        getApplication: vi.fn(),
        getApplicationByTab: vi.fn(),
      },
      { get: vi.fn(), set },
    );

    await expect(
      controller.start({ jobId: "job-1", originatingTabId: 10, activeTabIds: [10, 20] }),
    ).resolves.toEqual(session);
    expect(set.mock.calls).toEqual([
      [10, "application-1"],
      [20, "application-1"],
    ]);
  });

  it("recovers after reload from the local tab map, then falls back to backend tab data", async () => {
    const getApplication = vi.fn().mockResolvedValue(session);
    const getApplicationByTab = vi.fn().mockResolvedValue(session);
    const set = vi.fn();
    const controller = new SessionController(
      { createApplication: vi.fn(), getApplication, getApplicationByTab },
      {
        get: vi.fn().mockResolvedValueOnce("application-1").mockResolvedValueOnce(null),
        set,
      },
    );

    await expect(controller.recover(20)).resolves.toEqual(session);
    await expect(controller.recover(20)).resolves.toEqual(session);
    expect(getApplication).toHaveBeenCalledWith("application-1");
    expect(getApplicationByTab).toHaveBeenCalledWith(20);
    expect(set).toHaveBeenLastCalledWith(20, "application-1");
  });
});

