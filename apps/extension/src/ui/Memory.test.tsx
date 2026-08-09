// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Memory } from "./Memory.js";

afterEach(cleanup);

describe("Memory", () => {
  it("shows global and application-specific stored answers", async () => {
    render(
      <Memory
        listMemories={async () => [
          {
            id: "memory-1",
            signature: "sig",
            normalizedQuestion: "why this role",
            value: "Because systems matter",
            scope: "application",
            sourceApplicationId: "application-1",
            pinned: false,
            usageCount: 1,
            createdAt: "2026-08-09T00:00:00.000Z",
            updatedAt: "2026-08-09T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(await screen.findByText("why this role")).toBeInTheDocument();
    expect(screen.getByText("Application-specific")).toBeInTheDocument();
    expect(screen.getByText("Because systems matter")).toBeInTheDocument();
  });
});
