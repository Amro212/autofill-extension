// @vitest-environment jsdom
import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveredField } from "./discover.js";
import { executeField } from "./execute.js";

function field(
  kind: DiscoveredField["field"]["kind"],
  elements: HTMLElement[],
  options?: DiscoveredField["field"]["options"],
): DiscoveredField {
  return {
    field: {
      id: `field-${kind}`,
      adapterId: "generic",
      pageKey: "apply",
      kind,
      label: "Test field",
      required: false,
      currentValue: "",
      ...(options === undefined ? {} : { options }),
      evidence: { ariaLabel: true },
      confidence: 0.9,
    },
    elements,
  };
}

describe("field execution", () => {
  let root: Root | undefined;

  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(async () => {
    if (root !== undefined) {
      await act(async () => root?.unmount());
      root = undefined;
    }
  });

  it("uses native setters, emits normal events, verifies state, and can undo", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    const events: string[] = [];
    for (const type of ["input", "change", "blur"]) {
      input.addEventListener(type, () => events.push(type));
    }

    const result = await executeField(field("text", [input]), "Ada Lovelace");

    expect(result).toMatchObject({ ok: true, actualValue: "Ada Lovelace" });
    expect(input.value).toBe("Ada Lovelace");
    expect(events).toEqual(["input", "change", "blur"]);
    expect(input.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });

    expect(await result.undo()).toMatchObject({ ok: true, actualValue: "" });
    expect(input.value).toBe("");
  });

  it("survives a controlled React rerender by checking the real value", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    function ControlledInput() {
      const [value, setValue] = useState("");
      return (
        <input
          aria-label="Name"
          value={value}
          onInput={(event) => setValue(event.currentTarget.value)}
        />
      );
    }
    await act(async () => root?.render(<ControlledInput />));
    const input = container.querySelector("input")!;

    let result!: Awaited<ReturnType<typeof executeField>>;
    await act(async () => {
      result = await executeField(field("text", [input]), "Grace Hopper");
    });

    expect(result.ok).toBe(true);
    expect(container.querySelector("input")?.value).toBe("Grace Hopper");
  });

  it("matches selects exactly before fuzzy alternatives and rejects unsafe fallback", async () => {
    document.body.innerHTML = `
      <select>
        <option value="">Choose one</option>
        <option value="US">United States</option>
        <option value="UM">United States Minor Outlying Islands</option>
      </select>`;
    const select = document.querySelector("select")!;
    const discovered = field("native-select", [select], [
      { label: "Choose one", value: "" },
      { label: "United States", value: "US" },
      { label: "United States Minor Outlying Islands", value: "UM" },
    ]);

    const selected = await executeField(discovered, "united states");
    expect(selected.ok).toBe(true);
    expect(select.value).toBe("US");
    expect((await selected.undo()).ok).toBe(true);
    expect(select.value).toBe("");
    await executeField(discovered, "united states");
    const unmatched = await executeField(discovered, "Atlantis");
    expect(unmatched).toMatchObject({ ok: false, reason: "option-not-found" });
    expect(select.value).toBe("US");
  });

  it("sets and verifies radio and checkbox groups", async () => {
    document.body.innerHTML = `
      <input type="radio" name="work" value="yes">
      <input type="radio" name="work" value="no">
      <input type="checkbox" name="skills" value="ts">
      <input type="checkbox" name="skills" value="go">`;
    const [yes, no, ts, go] = [...document.querySelectorAll<HTMLInputElement>("input")];
    const radio = field("radio-group", [yes!, no!], [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ]);
    const checks = field("checkbox-group", [ts!, go!], [
      { label: "TypeScript", value: "ts" },
      { label: "Go", value: "go" },
    ]);

    expect((await executeField(radio, "No")).ok).toBe(true);
    expect(no?.checked).toBe(true);
    expect(yes?.checked).toBe(false);
    expect((await executeField(checks, ["TypeScript", "Go"])).ok).toBe(true);
    expect(ts?.checked).toBe(true);
    expect(go?.checked).toBe(true);
  });

  it("sets dates and contenteditable fields", async () => {
    const date = document.createElement("input");
    date.type = "date";
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.append(date, editable);

    expect((await executeField(field("date", [date]), "2026-08-09")).ok).toBe(true);
    expect(date.value).toBe("2026-08-09");
    expect((await executeField(field("contenteditable", [editable]), "Hello team")).ok).toBe(true);
    expect(editable.textContent).toBe("Hello team");
  });

  it("clicks the exact visible combobox option and verifies widget state", async () => {
    document.body.innerHTML = `
      <input role="combobox" aria-controls="countries" aria-valuetext="">
      <div role="listbox" id="countries">
        <button role="option">Canada</button>
        <button role="option">Canada East</button>
      </div>`;
    const combo = document.querySelector<HTMLInputElement>("[role='combobox']")!;
    const options = [...document.querySelectorAll<HTMLElement>("[role='option']")];
    for (const option of options) {
      option.addEventListener("click", () => {
        combo.value = option.textContent ?? "";
        combo.setAttribute("aria-valuetext", option.textContent ?? "");
      });
    }

    const result = await executeField(
      field("combobox", [combo], [
        { label: "Canada" },
        { label: "Canada East" },
      ]),
      "Canada",
    );

    expect(result.ok).toBe(true);
    expect(combo.getAttribute("aria-valuetext")).toBe("Canada");
  });
});
