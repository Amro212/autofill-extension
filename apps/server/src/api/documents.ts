import {
  documentKindSchema,
  documentMediaTypeSchema,
} from "@job-copilot/contracts";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createAuthGuard } from "../auth/guard.js";
import type { PairingService } from "../auth/pairing.js";
import {
  MAX_DOCUMENT_BYTES,
  type DocumentImportService,
} from "../documents/import.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

function fieldValue(
  fields: Record<string, unknown>,
  name: string,
): unknown {
  const field = fields[name];
  return typeof field === "object" && field !== null && "value" in field
    ? field.value
    : undefined;
}

export function registerDocumentRoutes(
  app: FastifyInstance,
  pairingService: PairingService,
  documents: DocumentImportService,
): void {
  app.register(multipart, {
    limits: { fields: 2, files: 1, parts: 3, fileSize: MAX_DOCUMENT_BYTES },
  });
  const preHandler = createAuthGuard(pairingService);

  app.get("/v1/documents", { preHandler }, async () => documents.list());
  app.post("/v1/documents", { preHandler }, async (request, reply) => {
    try {
      const part = await request.file({
        limits: { fields: 2, files: 1, parts: 3, fileSize: MAX_DOCUMENT_BYTES },
      });
      if (part === undefined) throw new Error("A document file is required");
      const bytes = await part.toBuffer();
      const kind = documentKindSchema.parse(fieldValue(part.fields, "kind"));
      const mediaType = documentMediaTypeSchema.parse(part.mimetype);
      const document = documents.import({
        bytes,
        filename: part.filename,
        kind,
        mediaType,
      });
      return reply.code(201).send(document);
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        error.statusCode === 413
          ? 413
          : 400;
      return reply.code(statusCode).send({
        error: { code: "UPLOAD_FAILED", message: "Document upload rejected" },
      });
    }
  });
  app.put("/v1/documents/:id/default", { preHandler }, async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "VALIDATION_FAILED", message: "Invalid document ID" },
      });
    }
    try {
      return documents.setDefault(parsed.data.id);
    } catch {
      return reply.code(404).send({
        error: { code: "UPLOAD_FAILED", message: "Document not found" },
      });
    }
  });
  app.get("/v1/documents/:id/content", { preHandler }, async (request, reply) => {
    const parsed = idParamsSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(404).send();
    try {
      const { metadata, bytes } = documents.read(parsed.data.id);
      reply.type(metadata.mediaType);
      reply.header(
        "content-disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(metadata.originalFilename)}`,
      );
      return reply.send(bytes);
    } catch {
      return reply.code(404).send();
    }
  });
}

