import type { DocumentImportService } from "./import.js";

export function readDocumentForStreaming(
  documents: DocumentImportService,
  id: string,
) {
  return documents.read(id);
}

