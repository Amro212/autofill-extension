import { z } from "zod";

import { jsonValueSchema, normalizedFieldSchema } from "./fields.js";

const boundedTextSchema = z.string().max(20_000);

export const aiAnswerValueSchema = z.union([
  boundedTextSchema,
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(2_000)).max(50),
]);

export const fieldAnswerSchema = z
  .object({
    fieldId: z.string().min(1).max(256),
    value: aiAnswerValueSchema,
    confidence: z.number().min(0).max(1).optional(),
    inferred: z.boolean().optional(),
    rationaleCode: z.string().min(1).max(128).optional(),
  })
  .strict();

export const pageAnswerRequestSchema = z
  .object({
    applicationId: z.string().min(1).max(256).optional(),
    pageKey: z.string().min(1).max(2_048),
    fields: z.array(normalizedFieldSchema).min(1).max(200),
  })
  .strict();

export const pageAnswerResultSchema = z
  .object({
    answers: z.array(fieldAnswerSchema).max(200),
  })
  .strict()
  .superRefine((result, context) => {
    const seen = new Set<string>();
    for (const answer of result.answers) {
      if (seen.has(answer.fieldId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate answer for field ${answer.fieldId}`,
        });
      }
      seen.add(answer.fieldId);
    }
  });

export const rewriteRequestSchema = z
  .object({
    applicationId: z.string().min(1).max(256).optional(),
    field: normalizedFieldSchema,
    currentAnswer: boundedTextSchema,
    feedback: z.string().max(2_000).optional(),
  })
  .strict();

export const rewriteResultSchema = z
  .object({
    fieldId: z.string().min(1).max(256),
    value: boundedTextSchema,
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

export const answerSourceSchema = z.enum([
  "profile",
  "resume",
  "memory",
  "ai",
  "rewrite",
  "inferred",
  "manual",
]);

export const answerRecordSchema = z
  .object({
    id: z.string().min(1),
    applicationId: z.string().min(1),
    fieldSignature: z.string().min(1),
    question: z.string().min(1),
    value: jsonValueSchema,
    previousValue: jsonValueSchema.optional(),
    source: answerSourceSchema,
    confidence: z.number().min(0).max(1).optional(),
    inferred: z.boolean().optional(),
    rationaleCode: z.string().min(1).max(128).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const answerMemorySchema = z.object({
  id: z.string().min(1),
  signature: z.string().min(1),
  normalizedQuestion: z.string().min(1),
  value: jsonValueSchema,
  scope: z.enum(["global", "application"]),
  domain: z.string().min(1).optional(),
  sourceApplicationId: z.string().min(1).optional(),
  pinned: z.boolean(),
  usageCount: z.number().int().nonnegative(),
  lastUsedAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AiAnswerValue = z.infer<typeof aiAnswerValueSchema>;
export type FieldAnswer = z.infer<typeof fieldAnswerSchema>;
export type PageAnswerRequest = z.infer<typeof pageAnswerRequestSchema>;
export type PageAnswerResult = z.infer<typeof pageAnswerResultSchema>;
export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;
export type RewriteResult = z.infer<typeof rewriteResultSchema>;
export type AnswerSource = z.infer<typeof answerSourceSchema>;
export type AnswerRecord = z.infer<typeof answerRecordSchema>;
export type AnswerMemory = z.infer<typeof answerMemorySchema>;
