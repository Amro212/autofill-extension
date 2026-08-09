import { z } from "zod";

export const errorCodeSchema = z.enum([
  "BACKEND_OFFLINE",
  "BACKEND_UNPAIRED",
  "SESSION_CORRELATION_FAILED",
  "JOB_CONTEXT_MISSING",
  "FIELD_DISCOVERY_FAILED",
  "FIELD_ACTION_FAILED",
  "FIELD_VERIFICATION_FAILED",
  "FIELD_VALUE_REJECTED",
  "VALIDATION_FAILED",
  "NAVIGATION_FAILED",
  "UPLOAD_FAILED",
  "DOCUMENT_GENERATION_FAILED",
  "LLM_TIMEOUT",
  "LLM_PROVIDER_ERROR",
  "LLM_INVALID_RESPONSE",
  "CAPTCHA_WAIT",
  "USER_BOUNDARY",
]);

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
  }),
});

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
