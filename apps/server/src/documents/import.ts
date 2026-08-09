import { createHash } from "node:crypto";

import {
  documentKindSchema,
  documentMediaTypeSchema,
  type DocumentKind,
  type DocumentMediaType,
  type DocumentMetadata,
} from "@job-copilot/contracts";

import type { DocumentRepository } from "../repositories/documents.js";
import { DocumentStorage, sanitizeDocumentFilename } from "./storage.js";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DocumentImportInput {
  bytes: Buffer;
  filename: string;
  kind: DocumentKind;
  mediaType: DocumentMediaType;
  sourceDocumentId?: string;
  applicationId?: string;
  jobId?: string;
  promptVersion?: string;
  tags?: string[];
}

export interface GeneratedDocumentInput extends DocumentImportInput {
  sourceDocumentId: string;
  promptVersion: string;
}

function matchesSignature(bytes: Buffer, mediaType: DocumentMediaType): boolean {
  if (mediaType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export class DocumentImportService {
  constructor(
    private readonly storage: DocumentStorage,
    private readonly documents: DocumentRepository,
  ) {}

  import(input: DocumentImportInput): DocumentMetadata {
    return this.#store(input, "uploaded");
  }

  storeGenerated(input: GeneratedDocumentInput): DocumentMetadata {
    return this.#store(input, "generated");
  }

  #store(
    input: DocumentImportInput | GeneratedDocumentInput,
    source: "uploaded" | "generated",
  ): DocumentMetadata {
    const kind = documentKindSchema.parse(input.kind);
    const mediaType = documentMediaTypeSchema.parse(input.mediaType);
    if (input.bytes.length === 0) throw new Error("Document is empty");
    if (input.bytes.length > MAX_DOCUMENT_BYTES) {
      throw new Error(`Document exceeds ${MAX_DOCUMENT_BYTES} bytes`);
    }
    const originalFilename = sanitizeDocumentFilename(input.filename);
    const expectedExtension = mediaType === "application/pdf" ? ".pdf" : ".docx";
    if (
      !originalFilename.toLowerCase().endsWith(expectedExtension) ||
      !matchesSignature(input.bytes, mediaType)
    ) {
      throw new Error("Document content does not match its type");
    }

    const storageKey = this.storage.store(input.bytes);
    try {
      return this.documents.create({
        kind,
        source,
        originalFilename,
        mediaType: mediaType === DOCX_MEDIA_TYPE ? DOCX_MEDIA_TYPE : "application/pdf",
        sizeBytes: input.bytes.length,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
        storageKey,
        ...(source === "generated"
          ? {
              sourceDocumentId: input.sourceDocumentId,
              promptVersion: input.promptVersion,
              ...(input.applicationId === undefined
                ? {}
                : { applicationId: input.applicationId }),
              ...(input.jobId === undefined ? {} : { jobId: input.jobId }),
              tags: input.tags ?? [],
            }
          : {}),
      });
    } catch (error) {
      this.storage.delete(storageKey);
      throw error;
    }
  }

  list(): DocumentMetadata[] {
    return this.documents.list();
  }

  setDefault(id: string): DocumentMetadata {
    return this.documents.setDefault(id);
  }

  read(id: string): { metadata: DocumentMetadata; bytes: Buffer } {
    const stored = this.documents.get(id);
    if (stored === undefined) throw new Error("Document not found");
    const { storageKey, ...metadata } = stored;
    return { metadata, bytes: this.storage.read(storageKey) };
  }
}
