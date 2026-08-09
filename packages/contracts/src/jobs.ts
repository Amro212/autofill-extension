import { z } from "zod";

const optionalText = z.string().trim().min(1).optional();

export const jobDataSchema = z.object({
  company: optionalText,
  title: optionalText,
  location: optionalText,
  jobId: optionalText,
  descriptionRaw: optionalText,
  descriptionNormalized: optionalText,
  requirements: z.array(z.string().trim().min(1)).default([]),
  preferredQualifications: z.array(z.string().trim().min(1)).default([]),
  responsibilities: z.array(z.string().trim().min(1)).default([]),
  listingUrl: z.url().optional(),
  applicationUrl: z.url().optional(),
  ats: optionalText,
});

export const jobCaptureSchema = jobDataSchema.refine(
  (job) => job.title !== undefined || job.descriptionNormalized !== undefined,
  { message: "A job needs a title or description" },
);

export const jobRecordSchema = jobDataSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
  capturedAt: z.iso.datetime(),
});

export type JobCapture = z.input<typeof jobCaptureSchema>;
export type JobRecord = z.infer<typeof jobRecordSchema>;
