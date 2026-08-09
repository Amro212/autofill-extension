import { z } from "zod";

export const applicationStateSchema = z.enum([
  "DISCOVERED",
  "JOB_CONTEXT_CAPTURED",
  "APPLICATION_LINKED",
  "WAITING_FOR_USER_START",
  "SCANNING",
  "GENERATING",
  "FILLING",
  "VERIFYING_FIELDS",
  "REPAIRING",
  "VALIDATING_PAGE",
  "READY_TO_CONTINUE",
  "NAVIGATING",
  "AWAITING_CAPTCHA",
  "USER_BOUNDARY",
  "READY_TO_SUBMIT",
  "SUBMITTING",
  "SUBMITTED",
  "FAILED",
  "PAUSED",
]);

export const applicationSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  jobId: z.string().min(1).optional(),
  state: applicationStateSchema,
  originatingTabId: z.number().int().optional(),
  activeTabIds: z.array(z.number().int()).optional(),
  adapterId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().optional(),
  aiAutofill: z.boolean().default(true),
  autoContinue: z.boolean().default(true),
  autoSubmit: z.boolean().default(false),
  autopilot: z.boolean().default(false),
});

export type ApplicationState = z.infer<typeof applicationStateSchema>;
export type ApplicationSession = z.infer<typeof applicationSessionSchema>;
