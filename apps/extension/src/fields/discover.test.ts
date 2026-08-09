// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { discoverFields } from "./discover.js";

describe("discoverFields", () => {
  it("normalizes native, grouped, custom, editable, upload, and repeated fields", () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email address *</label><input id="email" type="email" required>
        <label>Summary<textarea name="summary"></textarea></label>
        <label for="country">Country</label><select id="country"><option value="">Choose</option><option value="CA">Canada</option></select>
        <fieldset><legend>Sponsorship</legend><label><input type="radio" name="sponsor" value="yes">Yes</label><label><input type="radio" name="sponsor" value="no">No</label></fieldset>
        <label><input type="checkbox" name="terms">I agree</label>
        <div role="combobox" aria-label="City" aria-expanded="true"></div><div role="listbox"><div role="option">Toronto</div></div>
        <div contenteditable="true" aria-label="Cover note"></div>
        <label for="resume">Resume</label><input id="resume" type="file" accept=".pdf,.docx">
        <section aria-label="Employment 1"><label>Company<input name="company-1"></label></section>
        <section aria-label="Employment 2"><label>Company<input name="company-2"></label></section>
        <input aria-hidden="true" name="hidden-clone">
      </form>`;

    const discovered = discoverFields(document, "page-1");
    expect(discovered.map(({ field }) => field.kind)).toEqual(
      expect.arrayContaining([
        "email",
        "textarea",
        "native-select",
        "radio-group",
        "checkbox",
        "combobox",
        "contenteditable",
        "file",
        "text",
      ]),
    );
    expect(discovered.filter(({ field }) => field.label === "Sponsorship")).toHaveLength(1);
    expect(discovered.find(({ field }) => field.label === "Country")?.field.options).toEqual([
      { label: "Choose", value: "" },
      { label: "Canada", value: "CA" },
    ]);
    expect(discovered.find(({ field }) => field.label === "City")?.field.options).toEqual([
      { label: "Toronto" },
    ]);
    expect(discovered.filter(({ field }) => field.label === "Company")).toHaveLength(2);
    expect(discovered.some(({ field }) => field.label === "hidden-clone")).toBe(false);
    expect(new Set(discovered.map(({ field }) => field.id)).size).toBe(discovered.length);
  });

  it("refreshes async combobox options without duplicating the logical field", () => {
    document.body.innerHTML = `<div role="combobox" aria-label="School" aria-controls="schools"></div><div id="schools" role="listbox"></div>`;
    const first = discoverFields(document, "page-1");
    document.querySelector("[role=listbox]")!.innerHTML = `<div role="option">University of Toronto</div>`;
    const second = discoverFields(document, "page-1");
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0]!.field.id).toBe(first[0]!.field.id);
    expect(second[0]!.field.options).toEqual([{ label: "University of Toronto" }]);
  });
});

