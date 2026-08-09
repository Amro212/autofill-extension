import { z } from "zod";

export const documentKindSchema = z.enum([
  "resume",
  "cover-letter",
  "transcript",
  "other",
]);

export const documentSourceSchema = z.enum(["uploaded", "generated"]);

export const documentMediaTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const documentMetadataSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  kind: documentKindSchema,
  source: documentSourceSchema,
  originalFilename: z.string().min(1),
  mediaType: documentMediaTypeSchema,
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentMediaType = z.infer<typeof documentMediaTypeSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

