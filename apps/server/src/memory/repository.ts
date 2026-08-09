import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { jsonValueSchema, type JsonValue } from "@job-copilot/contracts";

import type { JobCopilotDatabase } from "../db/client.js";
import { answerMemories } from "../db/schema.js";
import { ensureLocalUser } from "../repositories/local-user.js";
import {
  rankMemories,
  type MemoryCandidate,
  type MemoryRankingContext,
} from "./ranking.js";
import { createQuestionSignature, normalizeQuestion } from "./signature.js";

export interface RememberAnswerInput {
  question: string;
  value: JsonValue;
  scope: "global" | "application";
  domain?: string;
  sourceApplicationId?: string;
  pinned?: boolean;
}

function fromRow(row: typeof answerMemories.$inferSelect): MemoryCandidate {
  return {
    id: row.id,
    signature: row.signature,
    normalizedQuestion: row.normalizedQuestion,
    value: jsonValueSchema.parse(JSON.parse(row.valueJson)),
    scope: row.scope === "application" ? "application" : "global",
    ...(row.domain === null ? {} : { domain: row.domain }),
    ...(row.sourceApplicationId === null
      ? {}
      : { sourceApplicationId: row.sourceApplicationId }),
    pinned: row.pinned,
    usageCount: row.usageCount,
    ...(row.lastUsedAt === null ? {} : { lastUsedAt: row.lastUsedAt }),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class AnswerMemoryRepository {
  readonly #userId: string;

  constructor(private readonly db: JobCopilotDatabase) {
    this.#userId = ensureLocalUser(db);
  }

  remember(input: RememberAnswerInput): MemoryCandidate {
    const value = jsonValueSchema.parse(input.value);
    if (input.scope === "application" && input.sourceApplicationId === undefined) {
      throw new TypeError("Application memory requires sourceApplicationId");
    }
    const now = new Date().toISOString();
    const row: typeof answerMemories.$inferInsert = {
      id: randomUUID(),
      userId: this.#userId,
      signature: createQuestionSignature(input.question),
      normalizedQuestion: normalizeQuestion(input.question),
      valueJson: JSON.stringify(value),
      scope: input.scope,
      domain: input.domain,
      sourceApplicationId: input.sourceApplicationId,
      pinned: input.pinned ?? false,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(answerMemories).values(row).run();
    return fromRow(this.db.select().from(answerMemories).where(eq(answerMemories.id, row.id)).get()!);
  }

  findRelevant(
    question: string,
    context: Omit<MemoryRankingContext, "signature">,
  ): MemoryCandidate[] {
    const signature = createQuestionSignature(question);
    const rows = this.db
      .select()
      .from(answerMemories)
      .where(
        and(
          eq(answerMemories.userId, this.#userId),
          eq(answerMemories.signature, signature),
        ),
      )
      .all();
    return rankMemories(rows.map(fromRow), { ...context, signature });
  }

  markUsed(id: string): void {
    const now = new Date().toISOString();
    this.db
      .update(answerMemories)
      .set({
        usageCount: sql`${answerMemories.usageCount} + 1`,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(and(eq(answerMemories.id, id), eq(answerMemories.userId, this.#userId)))
      .run();
  }
}
