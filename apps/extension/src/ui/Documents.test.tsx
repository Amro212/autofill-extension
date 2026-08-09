// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentMetadata, ResumeParseResult } from "@job-copilot/contracts";
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
  tags: [],
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

  it("parses an uploaded resume and offers editable profile suggestions", async () => {
    const parsed = {
      text: "Grace Hopper",
      canonical: {
        id: "resume-1",
        sourceDocumentId: metadata.id,
        name: "Grace Hopper",
        sections: [{
          id: "section-1",
          kind: "header",
          heading: "Header",
          facts: [{
            id: "fact-1",
            kind: "header",
            text: "Grace Hopper",
            sourceDocumentId: metadata.id,
            sourceExcerpt: "Grace Hopper",
          }],
        }],
        unsupportedSections: [],
        extractionWarnings: [],
        createdAt: "2026-08-09T00:00:00.000Z",
        updatedAt: "2026-08-09T00:00:00.000Z",
      },
      profileSuggestions: { identity: { firstName: "Grace", lastName: "Hopper" } },
    } satisfies ResumeParseResult;
    const parseResume = vi.fn().mockResolvedValue(parsed);
    const onProfileSuggestions = vi.fn();
    render(
      <Documents
        listDocuments={async () => [metadata]}
        uploadDocument={vi.fn()}
        setDefaultDocument={vi.fn()}
        parseResume={parseResume}
        onProfileSuggestions={onProfileSuggestions}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Review profile suggestions" }));
    await waitFor(() => expect(parseResume).toHaveBeenCalledWith(metadata.id));
    expect(onProfileSuggestions).toHaveBeenCalledWith(parsed.profileSuggestions);
    expect(await screen.findByText("Suggestions loaded. Review and save Profile.")).toBeInTheDocument();
  });
});
