import {
  canonicalResumeSchema,
  type CanonicalResume,
} from "@job-copilot/contracts";
import { and, eq } from "drizzle-orm";

import type { JobCopilotDatabase } from "../db/client.js";
import { canonicalResumes } from "../db/schema.js";
import { ensureLocalUser } from "./local-user.js";

export class CanonicalResumeRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  upsert(input: CanonicalResume): CanonicalResume {
    const canonical = canonicalResumeSchema.parse(input);
    const existing = this.db
      .select()
      .from(canonicalResumes)
      .where(
        and(
          eq(canonicalResumes.userId, this.#userId),
          eq(canonicalResumes.sourceDocumentId, canonical.sourceDocumentId),
        ),
      )
      .get();
    const row = {
      id: existing?.id ?? canonical.id,
      userId: this.#userId,
      sourceDocumentId: canonical.sourceDocumentId,
      dataJson: JSON.stringify(canonical),
      createdAt: existing?.createdAt ?? canonical.createdAt,
      updatedAt: canonical.updatedAt,
    };
    if (existing === undefined) {
      this.db.insert(canonicalResumes).values(row).run();
    } else {
      this.db
        .update(canonicalResumes)
        .set({ dataJson: row.dataJson, updatedAt: row.updatedAt })
        .where(eq(canonicalResumes.id, row.id))
        .run();
    }
    return canonical;
  }

  getBySourceDocumentId(sourceDocumentId: string): CanonicalResume | undefined {
    const row = this.db
      .select()
      .from(canonicalResumes)
      .where(
        and(
          eq(canonicalResumes.userId, this.#userId),
          eq(canonicalResumes.sourceDocumentId, sourceDocumentId),
        ),
      )
      .get();
    return row === undefined
      ? undefined
      : canonicalResumeSchema.parse(JSON.parse(row.dataJson));
  }
}
