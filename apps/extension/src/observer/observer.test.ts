// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { observeMutations } from "./mutations.js";
import { observeRoutes } from "./routes.js";

afterEach(() => vi.useRealTimers());

describe("observeMutations", () => {
  it("debounces dynamic DOM changes into one incremental batch", async () => {
    vi.useFakeTimers();
    const onBatch = vi.fn();
    const stop = observeMutations(document.body, onBatch, 50);

    document.body.append(document.createElement("input"));
    document.body.append(document.createElement("select"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(49);
    expect(onBatch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0]![0].addedRoots).toHaveLength(2);
    stop();
  });
});

describe("observeRoutes", () => {
  it("reports pushState, replaceState, and popstate URL changes once", () => {
    const onChange = vi.fn();
    const stop = observeRoutes(window, onChange);

    history.pushState({}, "", "/jobs/1");
    history.replaceState({}, "", "/jobs/2");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(onChange.mock.calls.map(([url]) => url.pathname)).toEqual([
      "/jobs/1",
      "/jobs/2",
    ]);
    stop();
  });
});

