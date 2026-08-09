import type { DocumentMediaType } from "@job-copilot/contracts";
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

function normalizeExtractedText(value: string): string {
  return value
    .replaceAll("\u0000", "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocumentText(
  bytes: Buffer,
  mediaType: DocumentMediaType,
): Promise<string> {
  let text: string;
  if (mediaType === "application/pdf") {
    const parser = new PDFParse({ data: Uint8Array.from(bytes) });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  const normalized = normalizeExtractedText(text);
  if (normalized === "") throw new Error("Document contains no extractable text");
  return normalized;
}
