import { z } from "zod";

import { jobDataSchema } from "./jobs.js";
import { applicantProfileDataSchema, applicantProfileUpdateSchema } from "./profile.js";

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
  sourceDocumentId: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: z.iso.datetime(),
});

export const resumeSectionKindSchema = z.enum([
  "header",
  "summary",
  "employment",
  "education",
  "projects",
  "skills",
  "certifications",
  "other",
]);

export const resumeFactSchema = z.object({
  id: z.string().min(1),
  kind: resumeSectionKindSchema,
  text: z.string().trim().min(1).max(20_000),
  sourceDocumentId: z.string().min(1),
  sourceExcerpt: z.string().trim().min(1).max(20_000),
  sourceLine: z.number().int().nonnegative().optional(),
});

export const resumeSectionSchema = z.object({
  id: z.string().min(1),
  kind: resumeSectionKindSchema,
  heading: z.string().trim().min(1),
  facts: z.array(resumeFactSchema).min(1),
});

export const canonicalResumeSchema = z.object({
  id: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  sections: z.array(resumeSectionSchema).min(1),
  unsupportedSections: z.array(z.string().trim().min(1)).default([]),
  extractionWarnings: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const resumeParseResultSchema = z.object({
  text: z.string().trim().min(1),
  canonical: canonicalResumeSchema,
  profileSuggestions: applicantProfileUpdateSchema,
});

export const generatedFactSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  sourceFactIds: z.array(z.string().min(1)).min(1),
});

export const tailoredResumeSchema = z.object({
  sourceDocumentId: z.string().min(1),
  promptVersion: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  summary: generatedFactSchema.optional(),
  sections: z
    .array(
      z.object({
        kind: resumeSectionKindSchema,
        heading: z.string().trim().min(1),
        bullets: z.array(generatedFactSchema).min(1),
      }),
    )
    .min(1),
});

export const coverLetterResultSchema = z.object({
  promptVersion: z.string().min(1),
  recipient: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  paragraphs: z.array(generatedFactSchema).min(1),
});

export const generatedDocumentFormatSchema = z.enum(["pdf", "docx", "both"]);

export const resumeTailorRequestSchema = z.object({
  applicationId: z.string().min(1).optional(),
  sourceDocumentId: z.string().min(1),
  canonical: canonicalResumeSchema,
  profile: applicantProfileDataSchema,
  job: jobDataSchema,
  format: generatedDocumentFormatSchema.default("both"),
  instructions: z.string().trim().max(2_000).optional(),
});

export const coverLetterRequestSchema = z.object({
  applicationId: z.string().min(1).optional(),
  sourceDocumentId: z.string().min(1),
  canonical: canonicalResumeSchema,
  profile: applicantProfileDataSchema,
  job: jobDataSchema,
  format: generatedDocumentFormatSchema.default("both"),
  instructions: z.string().trim().max(2_000).optional(),
});

export type DocumentKind = z.infer<typeof documentKindSchema>;
export type DocumentMediaType = z.infer<typeof documentMediaTypeSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
export type ResumeSectionKind = z.infer<typeof resumeSectionKindSchema>;
export type ResumeFact = z.infer<typeof resumeFactSchema>;
export type ResumeSection = z.infer<typeof resumeSectionSchema>;
export type CanonicalResume = z.infer<typeof canonicalResumeSchema>;
export type ResumeParseResult = z.infer<typeof resumeParseResultSchema>;
export type GeneratedFact = z.infer<typeof generatedFactSchema>;
export type TailoredResume = z.infer<typeof tailoredResumeSchema>;
export type CoverLetterResult = z.infer<typeof coverLetterResultSchema>;
export type GeneratedDocumentFormat = z.infer<typeof generatedDocumentFormatSchema>;
export type ResumeTailorRequest = z.input<typeof resumeTailorRequestSchema>;
export type CoverLetterRequest = z.input<typeof coverLetterRequestSchema>;
