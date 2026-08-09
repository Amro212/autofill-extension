// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { discoverFields } from "../fields/discover.js";
import { executeField } from "../fields/execute.js";
import { NormalizedFieldRegistry } from "../fields/registry.js";
import { extractJob } from "../jobs/extract.js";
import { classifyNavigation } from "../navigation/classify.js";
import { classifyPage } from "../page-classifier/index.js";
import { uploadFile } from "../uploads/controller.js";
import { inspectValidation } from "../validation/inspect.js";
import { detectAtsAdapter } from "./registry.js";

class FakeDataTransfer {
  readonly #files: File[] = [];
  readonly items = { add: (file: File) => void this.#files.push(file) };
  get files(): FileList {
    return this.#files as unknown as FileList;
  }
}

function fixture(name: string): Document {
  const html = readFileSync(
    join(process.cwd(), "tests", "fixtures", "ats", `${name}.html`),
    "utf8",
  );
  return new DOMParser().parseFromString(html, "text/html")!;
}

describe("ATS adapters", () => {
  it("detects and enhances a representative current Workday structure", async () => {
    const document = fixture("workday");
    const url = new URL(
      "https://example.wd5.myworkdayjobs.com/en-US/jobs/job/example_R12345/apply/applyManually",
    );
    const adapter = detectAtsAdapter(
      url,
      document,
    );
    const fields = discoverFields(document, "workday-step-2", adapter);

    expect(adapter.id).toBe("workday");
    expect(adapter.pageKind(document)).toBe("application");
    expect(classifyPage(document).type).toBe("application");
    expect(fields.every(({ field }) => field.adapterId === "workday")).toBe(true);
    expect(fields.some(({ field }) => field.label === "Enter website. This input is for robots only")).toBe(false);
    expect(fields.map(({ field }) => field.kind)).toEqual(
      expect.arrayContaining(["text", "combobox", "date", "file"]),
    );
    expect(fields.filter(({ field }) => field.label === "Company")).toHaveLength(2);
    expect(classifyNavigation(document, adapter).map(({ kind }) => kind)).toContain("continue");
    const registry = new NormalizedFieldRegistry();
    registry.reconcile(fields);
    expect(inspectValidation(document, registry)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "required" })]),
    );
    const firstName = fields.find(({ field }) => field.label === "First Name")!;
    const startDate = fields.find(({ field }) => field.kind === "date")!;
    HTMLElement.prototype.scrollIntoView ??= () => undefined;
    await expect(executeField(firstName, "Ada")).resolves.toMatchObject({ ok: true });
    await expect(executeField(startDate, "2026-09-01")).resolves.toMatchObject({ ok: true });
    const resume = fields
      .find(({ field }) => field.kind === "file")!
      .elements[0] as HTMLInputElement;
    await expect(
      uploadFile(
        resume,
        new File(["%PDF-test"], "resume.pdf", { type: "application/pdf" }),
        { createDataTransfer: () => new FakeDataTransfer() as unknown as DataTransfer },
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(extractJob(document, url)).toMatchObject({
      ats: "workday",
      title: "Software Engineer",
      jobId: "R12345",
    });
  });

  it("detects and enhances a representative current Greenhouse structure", async () => {
    const document = fixture("greenhouse");
    const url = new URL("https://job-boards.greenhouse.io/example/jobs/123");
    const adapter = detectAtsAdapter(
      url,
      document,
    );
    const fields = discoverFields(document, "greenhouse-application", adapter);

    expect(adapter.id).toBe("greenhouse");
    expect(adapter.pageKind(document)).toBe("application");
    expect(classifyPage(document).type).toBe("review");
    expect(fields.every(({ field }) => field.adapterId === "greenhouse")).toBe(true);
    expect(fields.find(({ field }) => field.label.startsWith("Resume/CV"))?.field.kind).toBe("file");
    expect(fields.find(({ field }) => field.label.startsWith("Work authorization"))?.field.options).toEqual([
      { label: "Yes" },
      { label: "No" },
    ]);
    expect(classifyNavigation(document, adapter).map(({ kind }) => kind)).toContain("submit");
    const authorization = fields.find(({ field }) =>
      field.label.startsWith("Work authorization"),
    )!;
    const authorizationInput = authorization.elements[0] as HTMLInputElement;
    for (const option of document.querySelectorAll<HTMLElement>("[role='option']")) {
      option.addEventListener("click", () => {
        authorizationInput.value = option.textContent ?? "";
        authorizationInput.setAttribute("aria-valuetext", authorizationInput.value);
      });
    }
    await expect(executeField(authorization, "Yes")).resolves.toMatchObject({
      ok: true,
      actualValue: "Yes",
    });
    expect(extractJob(document, url)).toMatchObject({
      ats: "greenhouse",
      title: "Software Engineer",
      jobId: "123",
    });
  });

  it("keeps a generic fallback for unknown sites", () => {
    const document = new DOMParser().parseFromString(
      "<form><label for='name'>Name</label><input id='name'></form>",
      "text/html",
    )!;
    expect(detectAtsAdapter(new URL("https://careers.example.test/apply"), document).id).toBe(
      "generic",
    );
  });
});
