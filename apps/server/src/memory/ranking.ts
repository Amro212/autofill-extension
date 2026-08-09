import type { JsonValue } from "@job-copilot/contracts";

export interface MemoryCandidate {
  id: string;
  signature: string;
  normalizedQuestion: string;
  value: JsonValue;
  scope: "global" | "application";
  domain?: string | undefined;
  sourceApplicationId?: string | undefined;
  pinned: boolean;
  usageCount: number;
  lastUsedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRankingContext {
  signature: string;
  domain?: string;
  applicationId?: string;
  limit?: number;
}

export function createEmployerScopeKey<T extends {
  id: string;
  company?: string | undefined;
}>(job: T): string {
  const company = job.company
    ?.normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  return company === undefined || company === ""
    ? `job:${job.id}`
    : `company:${company}`;
}

function sameDomain(left: string | undefined, right: string | undefined): boolean {
  return left !== undefined &&
    right !== undefined &&
    left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function safeForContext(memory: MemoryCandidate, context: MemoryRankingContext): boolean {
  if (memory.signature !== context.signature) return false;
  if (memory.scope === "application") {
    return (
      memory.sourceApplicationId !== undefined &&
      memory.sourceApplicationId === context.applicationId
    );
  }
  return memory.domain === undefined || sameDomain(memory.domain, context.domain);
}

function score(memory: MemoryCandidate): number {
  const timestamp = Date.parse(memory.lastUsedAt ?? memory.updatedAt);
  const recency = Number.isFinite(timestamp) ? timestamp / 1e15 : 0;
  return (memory.pinned ? 1_000 : 0) + Math.min(memory.usageCount, 100) * 10 + recency;
}

export function rankMemories<T extends MemoryCandidate>(
  candidates: readonly T[],
  context: MemoryRankingContext,
): T[] {
  const limit = context.limit ?? 10;
  return candidates
    .filter((memory) => safeForContext(memory, context))
    .sort((left, right) => score(right) - score(left))
    .slice(0, Math.max(0, limit));
}
