import { z } from "zod";

import { jsonValueSchema } from "./fields.js";

const optionalText = z.string().trim().min(1).optional();
const optionalUrl = z.url().optional();

export const profileIdentitySchema = z.object({
  firstName: optionalText,
  middleName: optionalText,
  lastName: optionalText,
  preferredName: optionalText,
});

export const profileContactSchema = z.object({
  email: z.email().optional(),
  phone: optionalText,
  city: optionalText,
  region: optionalText,
  country: optionalText,
  postalCode: optionalText,
  linkedin: optionalUrl,
  github: optionalUrl,
  portfolio: optionalUrl,
});

export const educationRecordSchema = z.object({
  id: z.string().min(1),
  institution: z.string().trim().min(1),
  degree: optionalText,
  fieldOfStudy: optionalText,
  location: optionalText,
  startDate: optionalText,
  endDate: optionalText,
  currentlyEnrolled: z.boolean().default(false),
  description: optionalText,
});

export const employmentRecordSchema = z.object({
  id: z.string().min(1),
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: optionalText,
  startDate: optionalText,
  endDate: optionalText,
  current: z.boolean().default(false),
  description: optionalText,
  highlights: z.array(z.string().trim().min(1)).default([]),
});

export const projectRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  role: optionalText,
  url: optionalUrl,
  startDate: optionalText,
  endDate: optionalText,
  description: optionalText,
  highlights: z.array(z.string().trim().min(1)).default([]),
});

export const skillRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  level: optionalText,
  years: z.number().nonnegative().optional(),
});

export const certificationRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  issuer: optionalText,
  issuedAt: optionalText,
  expiresAt: optionalText,
  credentialId: optionalText,
  url: optionalUrl,
});

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

export const profilePreferencesSchema = z.object({
  relocation: z.boolean().optional(),
  remote: z.boolean().optional(),
  hybrid: z.boolean().optional(),
  onsite: z.boolean().optional(),
  startDate: optionalText,
  salary: jsonRecordSchema.optional(),
});

export const applicantProfileDataSchema = z.object({
  identity: profileIdentitySchema.default({}),
  contact: profileContactSchema.default({}),
  education: z.array(educationRecordSchema).default([]),
  employment: z.array(employmentRecordSchema).default([]),
  projects: z.array(projectRecordSchema).default([]),
  skills: z.array(skillRecordSchema).default([]),
  certifications: z.array(certificationRecordSchema).default([]),
  eligibility: jsonRecordSchema.default({}),
  preferences: profilePreferencesSchema.default({}),
  customFacts: jsonRecordSchema.default({}),
});

export const applicantProfileSchema = applicantProfileDataSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const applicantProfileUpdateSchema = applicantProfileDataSchema.partial();

export type ApplicantProfile = z.infer<typeof applicantProfileSchema>;
export type ApplicantProfileData = z.infer<typeof applicantProfileDataSchema>;
export type ApplicantProfileUpdate = z.infer<typeof applicantProfileUpdateSchema>;

