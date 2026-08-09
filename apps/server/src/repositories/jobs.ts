import { randomUUID } from "node:crypto";

import {
  jobCaptureSchema,
  jobDataSchema,
  jobRecordSchema,
  type JobCapture,
  type JobRecord,
} from "@job-copilot/contracts";
import { and, desc, eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { jobs } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export class JobRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  create(input: JobCapture): JobRecord {
    const data = jobCaptureSchema.parse(input);
    const row = {
      id: randomUUID(),
      userId: this.#userId,
      dataJson: JSON.stringify(jobDataSchema.parse(data)),
      capturedAt: new Date().toISOString(),
    };
    this.db.insert(jobs).values(row).run();
    return this.#fromRow(row);
  }

  get(id: string): JobRecord | undefined {
    const row = this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, this.#userId)))
      .get();
    return row === undefined ? undefined : this.#fromRow(row);
  }

  list(limit = 20): JobRecord[] {
    return this.db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, this.#userId))
      .orderBy(desc(jobs.capturedAt))
      .limit(Math.min(Math.max(limit, 1), 100))
      .all()
      .map((row) => this.#fromRow(row));
  }

  #fromRow(row: typeof jobs.$inferSelect): JobRecord {
    return jobRecordSchema.parse({
      id: row.id,
      userId: row.userId,
      ...JSON.parse(row.dataJson),
      capturedAt: row.capturedAt,
    });
  }
}

