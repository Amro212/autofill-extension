import { randomUUID } from "node:crypto";

import {
  applicantProfileDataSchema,
  applicantProfileSchema,
  applicantProfileUpdateSchema,
  type ApplicantProfile,
  type ApplicantProfileUpdate,
} from "@job-copilot/contracts";
import { eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export class ProfileRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  get(): ApplicantProfile {
    let row = this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, this.#userId))
      .get();
    if (row === undefined) {
      const now = new Date().toISOString();
      row = {
        id: randomUUID(),
        userId: this.#userId,
        dataJson: JSON.stringify(applicantProfileDataSchema.parse({})),
        createdAt: now,
        updatedAt: now,
      };
      this.db.insert(profiles).values(row).run();
    }
    return applicantProfileSchema.parse({
      id: row.id,
      userId: row.userId,
      ...JSON.parse(row.dataJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  update(input: ApplicantProfileUpdate): ApplicantProfile {
    const patch = applicantProfileUpdateSchema.parse(input);
    const current = this.get();
    const data = applicantProfileDataSchema.parse({ ...current, ...patch });
    const updatedAt = new Date().toISOString();
    this.db
      .update(profiles)
      .set({ dataJson: JSON.stringify(data), updatedAt })
      .where(eq(profiles.id, current.id))
      .run();
    return applicantProfileSchema.parse({
      id: current.id,
      userId: current.userId,
      ...data,
      createdAt: current.createdAt,
      updatedAt,
    });
  }
}

