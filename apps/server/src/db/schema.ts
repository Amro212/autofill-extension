import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  dataJson: text("data_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const settings = sqliteTable("settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  aiAutofill: integer("ai_autofill", { mode: "boolean" }).notNull(),
  autoContinue: integer("auto_continue", { mode: "boolean" }).notNull(),
  autoSubmit: integer("auto_submit", { mode: "boolean" }).notNull(),
  autopilot: integer("autopilot", { mode: "boolean" }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const installations = sqliteTable("installations", {
  installationId: text("installation_id").primaryKey(),
  pairingSecretHash: text("pairing_secret_hash").notNull(),
  tokenHash: text("token_hash"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  dataJson: text("data_json").notNull(),
  capturedAt: text("captured_at").notNull(),
});

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  jobId: text("job_id").references(() => jobs.id),
  state: text("state").notNull(),
  dataJson: text("data_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  source: text("source").notNull(),
  originalFilename: text("original_filename").notNull(),
  mediaType: text("media_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull(),
  sourceDocumentId: text("source_document_id"),
  applicationId: text("application_id"),
  jobId: text("job_id"),
  promptVersion: text("prompt_version"),
  tagsJson: text("tags_json").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export const canonicalResumes = sqliteTable("canonical_resumes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  sourceDocumentId: text("source_document_id").notNull().unique(),
  dataJson: text("data_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const answerMemories = sqliteTable("answer_memories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  signature: text("signature").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  valueJson: text("value_json").notNull(),
  scope: text("scope").notNull(),
  domain: text("domain"),
  sourceApplicationId: text("source_application_id"),
  pinned: integer("pinned", { mode: "boolean" }).notNull(),
  usageCount: integer("usage_count").notNull(),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const answerRecords = sqliteTable("answer_records", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  applicationId: text("application_id")
    .notNull()
    .references(() => applications.id),
  fieldSignature: text("field_signature").notNull(),
  question: text("question").notNull(),
  valueJson: text("value_json").notNull(),
  previousValueJson: text("previous_value_json"),
  source: text("source").notNull(),
  confidence: text("confidence"),
  inferred: integer("inferred", { mode: "boolean" }),
  rationaleCode: text("rationale_code"),
  createdAt: text("created_at").notNull(),
});
