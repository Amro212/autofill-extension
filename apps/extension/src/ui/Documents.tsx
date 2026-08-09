import type {
  ApplicantProfileUpdate,
  DocumentKind,
  DocumentMetadata,
  ResumeParseResult,
} from "@job-copilot/contracts";
import { type FormEvent, useEffect, useState } from "react";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface DocumentsProps {
  listDocuments: () => Promise<DocumentMetadata[]>;
  uploadDocument: (input: {
    file: File;
    kind: DocumentKind;
  }) => Promise<DocumentMetadata>;
  setDefaultDocument: (id: string) => Promise<DocumentMetadata>;
  parseResume?: (id: string) => Promise<ResumeParseResult>;
  onProfileSuggestions?: (suggestions: ApplicantProfileUpdate) => void;
  generateResume?: (sourceDocumentId: string) => Promise<DocumentMetadata[]>;
  generateCoverLetter?: (sourceDocumentId: string) => Promise<DocumentMetadata[]>;
}

export function Documents(props: DocumentsProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [kind, setKind] = useState<DocumentKind>("resume");
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">(
    "loading",
  );
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    props.listDocuments().then(
      (items) => {
        if (active) {
          setDocuments(items);
          setStatus("ready");
        }
      },
      () => active && setStatus("error"),
    );
    return () => {
      active = false;
    };
  }, [props.listDocuments]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (file === undefined || file.size > MAX_DOCUMENT_BYTES) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const created = await props.uploadDocument({ file, kind });
      setDocuments((current) => [...current, created]);
      setFile(undefined);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function makeDefault(id: string) {
    setStatus("saving");
    try {
      const updated = await props.setDefaultDocument(id);
      setDocuments((current) =>
        current.map((document) =>
          document.kind === updated.kind
            ? { ...document, isDefault: document.id === updated.id }
            : document,
        ),
      );
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function reviewSuggestions(id: string) {
    if (props.parseResume === undefined) return;
    setStatus("saving");
    setSuggestionsLoaded(false);
    try {
      const parsed = await props.parseResume(id);
      props.onProfileSuggestions?.(parsed.profileSuggestions);
      setSuggestionsLoaded(true);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function generate(
    id: string,
    action: ((sourceDocumentId: string) => Promise<DocumentMetadata[]>) | undefined,
  ) {
    if (action === undefined) return;
    setStatus("saving");
    try {
      const generated = await action(id);
      setDocuments((current) => [
        ...current.filter((document) => !generated.some(({ id: nextId }) => nextId === document.id)),
        ...generated,
      ]);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="job-copilot-section">
      <h2>Documents</h2>
      {documents.length === 0 && status !== "loading" && <p>No documents yet.</p>}
      <ul className="job-copilot-documents">
        {documents.map((document) => (
          <li key={document.id}>
            <span title={document.originalFilename}>{document.originalFilename}</span>
            {document.isDefault ? (
              <small>Default</small>
            ) : (
              <button type="button" onClick={() => makeDefault(document.id)}>
                Make default
              </button>
            )}
            {document.kind === "resume" && props.parseResume !== undefined && (
              <button type="button" onClick={() => void reviewSuggestions(document.id)}>
                Review profile suggestions
              </button>
            )}
            {document.kind === "resume" && document.source === "uploaded" && (
              <>
                {props.generateResume !== undefined && (
                  <button type="button" onClick={() => void generate(document.id, props.generateResume)}>
                    Generate tailored resume
                  </button>
                )}
                {props.generateCoverLetter !== undefined && (
                  <button
                    type="button"
                    onClick={() => void generate(document.id, props.generateCoverLetter)}
                  >
                    Generate cover letter
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={upload} className="job-copilot-document-upload">
        <label>
          Document kind
          <select value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>
            <option value="resume">Resume</option>
            <option value="cover-letter">Cover letter</option>
            <option value="transcript">Transcript</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Document file
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
        </label>
        <button type="submit" disabled={status === "saving" || file === undefined}>
          Upload document
        </button>
      </form>
      {suggestionsLoaded && (
        <small role="status">Suggestions loaded. Review and save Profile.</small>
      )}
      {status === "error" && <small role="alert">Document action failed</small>}
    </section>
  );
}
