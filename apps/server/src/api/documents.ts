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
import type { DocumentWorkflowService } from "../documents/workflow.js";
import type { DocumentStrategyService } from "../documents/strategy.js";

const idParamsSchema = z.object({ id: z.string().uuid() });
const generateRequestSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  jobId: z.string().uuid(),
  applicationId: z.string().min(1).optional(),
  format: z.enum(["pdf", "docx", "both"]).default("both"),
  instructions: z.string().trim().min(1).max(2_000).optional(),
});

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
  workflow?: DocumentWorkflowService,
  strategy?: DocumentStrategyService,
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
  if (workflow !== undefined) {
    app.post("/v1/documents/:id/parse", { preHandler }, async (request, reply) => {
      const parsed = idParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: "VALIDATION_FAILED", message: "Invalid document ID" },
        });
      }
      try {
        return await workflow.parseResume(parsed.data.id);
      } catch {
        return reply.code(422).send({
          error: { code: "DOCUMENT_PARSE_FAILED", message: "Resume parsing failed" },
        });
      }
    });
    const registerGeneration = (
      path: string,
      generate: (input: z.infer<typeof generateRequestSchema>) => Promise<unknown>,
    ) => {
      app.post(path, { preHandler }, async (request, reply) => {
        const parsed = generateRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: { code: "VALIDATION_FAILED", message: "Invalid generation request" },
          });
        }
        try {
          return reply.code(201).send(await generate(parsed.data));
        } catch {
          return reply.code(422).send({
            error: {
              code: "DOCUMENT_GENERATION_FAILED",
              message: "Document generation failed",
            },
          });
        }
      });
    };
    registerGeneration("/v1/documents/generate/resume", (input) =>
      workflow.generateResume(input),
    );
    registerGeneration("/v1/documents/generate/cover-letter", (input) =>
      workflow.generateCoverLetter(input),
    );
  }
  if (strategy !== undefined) {
    app.post(
      "/v1/applications/:id/documents/select",
      { preHandler },
      async (request, reply) => {
        const params = idParamsSchema.safeParse(request.params);
        const body = z.object({ kind: documentKindSchema }).safeParse(request.body);
        if (!params.success || !body.success) {
          return reply.code(400).send({
            error: { code: "VALIDATION_FAILED", message: "Invalid selection request" },
          });
        }
        try {
          return await strategy.select({
            applicationId: params.data.id,
            kind: body.data.kind,
          });
        } catch {
          return reply.code(404).send({
            error: { code: "UPLOAD_FAILED", message: "Required document unavailable" },
          });
        }
      },
    );
  }
}
