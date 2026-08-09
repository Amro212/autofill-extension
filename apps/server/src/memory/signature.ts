import { createHash } from "node:crypto";

export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\((?:required|optional)\)/giu, " ")
    .replace(/\b(?:required|optional)\b/giu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createQuestionSignature(question: string): string {
  const normalized = normalizeQuestion(question);
  if (normalized === "") throw new TypeError("Question cannot be empty");
  return createHash("sha256").update(normalized).digest("hex");
}
