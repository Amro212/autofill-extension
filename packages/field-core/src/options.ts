import { normalizeForMatch } from "./normalize.js";

export interface MatchableOption {
  label: string;
  value?: string;
  disabled?: boolean;
}

export function matchOption<T extends MatchableOption>(
  options: T[],
  requested: string,
): T | undefined {
  const needle = normalizeForMatch(requested);
  if (needle === "") return undefined;
  const enabled = options.filter((option) => option.disabled !== true);
  const exact = enabled.find(
    (option) =>
      normalizeForMatch(option.label) === needle ||
      (option.value !== undefined && normalizeForMatch(option.value) === needle),
  );
  if (exact !== undefined) return exact;
  const words = new Set(needle.split(" "));
  const ranked = enabled
    .map((option) => {
      const candidateWords = new Set(normalizeForMatch(option.label).split(" "));
      const overlap = [...words].filter((word) => candidateWords.has(word)).length;
      return { option, score: overlap / Math.max(words.size, candidateWords.size) };
    })
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score !== undefined && ranked[0].score >= 0.5
    ? ranked[0].option
    : undefined;
}

