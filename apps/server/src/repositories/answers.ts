import { randomUUID } from "node:crypto";

import {
  answerRecordSchema,
  jsonValueSchema,
  type AnswerRecord,
  type AnswerSource,
  type JsonValue,
} from "@job-copilot/contracts";
import { and, asc, eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { answerRecords } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export interface RecordAnswerInput {
  applicationId: string;
  fieldSignature: string;
  question: string;
  value: JsonValue;
  previousValue?: JsonValue;
  source: AnswerSource;
  confidence?: number;
  inferred?: boolean;
  rationaleCode?: string;
}

function fromRow(row: typeof answerRecords.$inferSelect): AnswerRecord {
  return answerRecordSchema.parse({
    id: row.id,
    applicationId: row.applicationId,
    fieldSignature: row.fieldSignature,
    question: row.question,
    value: JSON.parse(row.valueJson),
    ...(row.previousValueJson === null
      ? {}
      : { previousValue: JSON.parse(row.previousValueJson) }),
    source: row.source,
    ...(row.confidence === null ? {} : { confidence: Number(row.confidence) }),
    ...(row.inferred === null ? {} : { inferred: row.inferred }),
    ...(row.rationaleCode === null ? {} : { rationaleCode: row.rationaleCode }),
    createdAt: row.createdAt,
  });
}

export class AnswerRecordRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  record(input: RecordAnswerInput): AnswerRecord {
    const value = jsonValueSchema.parse(input.value);
    const previousValue =
      input.previousValue === undefined
        ? undefined
        : jsonValueSchema.parse(input.previousValue);
    const row: typeof answerRecords.$inferInsert = {
      id: randomUUID(),
      userId: this.#userId,
      applicationId: input.applicationId,
      fieldSignature: input.fieldSignature,
      question: input.question,
      valueJson: JSON.stringify(value),
      previousValueJson:
        previousValue === undefined ? undefined : JSON.stringify(previousValue),
      source: input.source,
      confidence:
        input.confidence === undefined ? undefined : String(input.confidence),
      inferred: input.inferred,
      rationaleCode: input.rationaleCode,
      createdAt: new Date().toISOString(),
    };
    this.db.insert(answerRecords).values(row).run();
    return fromRow(
      this.db.select().from(answerRecords).where(eq(answerRecords.id, row.id)).get()!,
    );
  }

  list(applicationId: string): AnswerRecord[] {
    return this.db
      .select()
      .from(answerRecords)
      .where(
        and(
          eq(answerRecords.userId, this.#userId),
          eq(answerRecords.applicationId, applicationId),
        ),
      )
      .orderBy(asc(answerRecords.createdAt))
      .all()
      .map(fromRow);
  }
}
