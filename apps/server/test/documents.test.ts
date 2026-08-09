import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { PairingService } from "../src/auth/pairing.js";
import { openDatabase } from "../src/db/client.js";
import { migrateDatabase } from "../src/db/migrate.js";
import {
  MAX_DOCUMENT_BYTES,
  DocumentImportService,
} from "../src/documents/import.js";
import { DocumentStorage, sanitizeDocumentFilename } from "../src/documents/storage.js";
import { parseResumeText } from "../src/documents/resume-parser.js";
import { CanonicalResumeRepository } from "../src/repositories/canonical-resumes.js";
import { DocumentRepository } from "../src/repositories/documents.js";

const cleanups: Array<() => Promise<void> | void> = [];
const pdf = Buffer.from("%PDF-1.7\nminimal-test-pdf\n%%EOF", "utf8");
const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);

function createLibrary() {
  const directory = mkdtempSync(join(tmpdir(), "job-copilot-documents-"));
  const connection = openDatabase(join(directory, "documents.sqlite"));
  migrateDatabase(connection);
  const storage = new DocumentStorage(join(directory, "uploads"));
  const repository = new DocumentRepository(connection.db);
  const service = new DocumentImportService(storage, repository);
  cleanups.push(() => {
    connection.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { connection, directory, repository, service, storage };
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("secure document library", () => {
  it("sanitizes hostile filenames and never uses them as storage paths", () => {
    expect(sanitizeDocumentFilename("../../private/..\\résumé\0.pdf")).toBe(
      "résumé.pdf",
    );
    const { service } = createLibrary();
    const saved = service.import({
      bytes: pdf,
      filename: "../../resume.pdf",
      kind: "resume",
      mediaType: "application/pdf",
    });

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.originalFilename).toBe("resume.pdf");
    expect(saved).not.toHaveProperty("storageKey");
  });

  it("rejects traversal keys at the storage boundary", () => {
    const { storage } = createLibrary();
    expect(() => storage.read("../outside.pdf")).toThrow("Invalid storage key");
  });

  it("accepts PDF and DOCX signatures and rejects MIME or size mismatches", () => {
    const { service } = createLibrary();
    expect(
      service.import({
        bytes: docx,
        filename: "resume.docx",
        kind: "resume",
        mediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).mediaType,
    ).toContain("wordprocessingml");
    expect(() =>
      service.import({
        bytes: pdf,
        filename: "resume.docx",
        kind: "resume",
        mediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toThrow("Document content does not match its type");
    expect(() =>
      service.import({
        bytes: Buffer.alloc(MAX_DOCUMENT_BYTES + 1),
        filename: "resume.pdf",
        kind: "resume",
        mediaType: "application/pdf",
      }),
    ).toThrow("Document exceeds");
  });

  it("lists metadata, streams exact bytes, and maintains one default per kind", () => {
    const { service } = createLibrary();
    const first = service.import({
      bytes: pdf,
      filename: "resume-one.pdf",
      kind: "resume",
      mediaType: "application/pdf",
    });
    const second = service.import({
      bytes: Buffer.concat([pdf, Buffer.from("-two")]),
      filename: "resume-two.pdf",
      kind: "resume",
      mediaType: "application/pdf",
    });

    service.setDefault(second.id);
    expect(service.list()).toHaveLength(2);
    expect(service.list().find((item) => item.id === first.id)?.isDefault).toBe(false);
    expect(service.list().find((item) => item.id === second.id)?.isDefault).toBe(true);
    expect(service.read(second.id).bytes).toEqual(Buffer.concat([pdf, Buffer.from("-two")]));
  });

  it("persists canonical resumes and generated-document provenance", () => {
    const { connection, service } = createLibrary();
    const source = service.import({
      bytes: pdf,
      filename: "source.pdf",
      kind: "resume",
      mediaType: "application/pdf",
    });
    const canonical = parseResumeText(
      "Ada Lovelace\n\nEXPERIENCE\nBuilt reliable TypeScript services.",
      source.id,
    ).canonical;
    const canonicalResumes = new CanonicalResumeRepository(connection.db);
    canonicalResumes.upsert(canonical);

    expect(canonicalResumes.getBySourceDocumentId(source.id)).toEqual(canonical);

    const generated = service.storeGenerated({
      bytes: Buffer.concat([pdf, Buffer.from("-tailored")]),
      filename: "tailored-resume.pdf",
      kind: "resume",
      mediaType: "application/pdf",
      sourceDocumentId: source.id,
      applicationId: "application-1",
      jobId: "job-1",
      promptVersion: "resume-tailor-v1",
      tags: ["tailored", "typescript"],
    });

    expect(generated).toMatchObject({
      source: "generated",
      sourceDocumentId: source.id,
      applicationId: "application-1",
      jobId: "job-1",
      promptVersion: "resume-tailor-v1",
      tags: ["tailored", "typescript"],
    });
  });
});

describe("document API", () => {
  it("requires auth, uploads multipart data, lists it, and streams it", async () => {
    const { service } = createLibrary();
    const pairingService = new PairingService({
      installationId: "installation-1",
      pairingSecret: "setup-secret",
    });
    const app = buildApp({ logger: false, pairingService, documentService: service });
    cleanups.push(() => app.close());
    const denied = await app.inject({ method: "GET", url: "/v1/documents" });
    expect(denied.statusCode).toBe(401);

    await app.listen({ host: "127.0.0.1", port: 0 });
    const token = pairingService.pair("setup-secret").token;
    const form = new FormData();
    form.set("kind", "resume");
    form.set("file", new Blob([pdf], { type: "application/pdf" }), "resume.pdf");
    const uploaded = await fetch(`${app.listeningOrigin}/v1/documents`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    expect(uploaded.status).toBe(201);
    const metadata = await uploaded.json() as { id: string };

    const listing = await fetch(`${app.listeningOrigin}/v1/documents`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await listing.json()).toEqual([
      expect.objectContaining({ id: metadata.id, originalFilename: "resume.pdf" }),
    ]);

    const streamed = await fetch(
      `${app.listeningOrigin}/v1/documents/${metadata.id}/content`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(streamed.headers.get("content-type")).toContain("application/pdf");
    expect(Buffer.from(await streamed.arrayBuffer())).toEqual(pdf);
  });
});
