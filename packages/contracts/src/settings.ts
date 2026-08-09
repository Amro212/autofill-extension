import { z } from "zod";

export const automationSettingsDataSchema = z.object({
  aiAutofill: z.boolean().default(true),
  autoContinue: z.boolean().default(true),
  autoSubmit: z.boolean().default(false),
  autopilot: z.boolean().default(false),
});

export const automationSettingsSchema = automationSettingsDataSchema.extend({
  userId: z.string().min(1),
  updatedAt: z.iso.datetime(),
});

export const automationSettingsUpdateSchema = automationSettingsDataSchema.partial();

export type AutomationSettings = z.infer<typeof automationSettingsSchema>;
export type AutomationSettingsUpdate = z.infer<
  typeof automationSettingsUpdateSchema
>;

