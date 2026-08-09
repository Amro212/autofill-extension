// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentMetadata } from "@job-copilot/contracts";
import { Documents } from "./Documents.js";

const metadata: DocumentMetadata = {
  id: "document-1",
  userId: "local-user",
  kind: "resume",
  source: "uploaded",
  originalFilename: "resume.pdf",
  mediaType: "application/pdf",
  sizeBytes: 64,
  sha256: "a".repeat(64),
  isDefault: false,
  createdAt: "2026-08-08T12:00:00.000Z",
};

afterEach(cleanup);

describe("Documents", () => {
  it("lists documents and uploads the selected local file without a path", async () => {
    const uploadDocument = vi.fn().mockResolvedValue(metadata);
    render(
      <Documents
        listDocuments={async () => [metadata]}
        uploadDocument={uploadDocument}
        setDefaultDocument={vi.fn()}
      />,
    );
    expect(await screen.findByText("resume.pdf")).toBeInTheDocument();

    const file = new File(["%PDF-test"], "new-resume.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Document file"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload document" }));

    await waitFor(() =>
      expect(uploadDocument).toHaveBeenCalledWith({ file, kind: "resume" }),
    );
  });

  it("can choose the default document for a kind", async () => {
    const setDefaultDocument = vi.fn().mockResolvedValue({
      ...metadata,
      isDefault: true,
    });
    render(
      <Documents
        listDocuments={async () => [metadata]}
        uploadDocument={vi.fn()}
        setDefaultDocument={setDefaultDocument}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Make default" }));
    await waitFor(() =>
      expect(setDefaultDocument).toHaveBeenCalledWith("document-1"),
    );
    expect(await screen.findByText("Default")).toBeInTheDocument();
  });
});

