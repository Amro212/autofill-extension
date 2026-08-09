// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { uploadFile } from "./controller.js";

class FakeDataTransfer {
  readonly #files: File[] = [];
  readonly items = { add: (file: File) => void this.#files.push(file) };
  get files(): FileList {
    return this.#files as unknown as FileList;
  }
}

describe("file upload execution", () => {
  it("fills a hidden input and verifies the accepted filename state", async () => {
    document.body.innerHTML = `
      <input id="resume" type="file" accept=".pdf" hidden>
      <output id="upload-status"></output>`;
    const input = document.querySelector<HTMLInputElement>("#resume")!;
    input.addEventListener("change", () => {
      document.querySelector("#upload-status")!.textContent =
        input.files?.[0]?.name ?? "";
    });
    const file = new File(["%PDF-test"], "resume.pdf", {
      type: "application/pdf",
    });

    const result = await uploadFile(input, file, {
      createDataTransfer: () => new FakeDataTransfer() as unknown as DataTransfer,
      acceptedState: () =>
        document.querySelector("#upload-status")?.textContent === "resume.pdf",
    });

    expect(result).toEqual({ ok: true, filename: "resume.pdf" });
    expect(input.files?.[0]).toBe(file);
  });

  it("fills a standard visible file input and dispatches its accepted change", async () => {
    document.body.innerHTML = `
      <label for="cover-letter">Cover letter</label>
      <input id="cover-letter" type="file" accept="application/pdf">
      <output id="cover-letter-name"></output>`;
    const input = document.querySelector<HTMLInputElement>("#cover-letter")!;
    input.addEventListener("change", () => {
      document.querySelector("#cover-letter-name")!.textContent = input.files?.[0]?.name ?? "";
    });
    const file = new File(["%PDF-cover"], "cover-letter.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadFile(input, file, {
        createDataTransfer: () => new FakeDataTransfer() as unknown as DataTransfer,
        acceptedState: () =>
          document.querySelector("#cover-letter-name")?.textContent === "cover-letter.pdf",
      }),
    ).resolves.toEqual({ ok: true, filename: "cover-letter.pdf" });
    expect(document.querySelector("#cover-letter-name")?.textContent).toBe("cover-letter.pdf");
  });

  it("rejects files outside the control's accepted types without mutating it", async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    const file = new File(["plain"], "resume.txt", { type: "text/plain" });

    await expect(uploadFile(input, file)).resolves.toMatchObject({
      ok: false,
      reason: "file-type-not-accepted",
    });
    expect(input.files).toHaveLength(0);
  });
});
