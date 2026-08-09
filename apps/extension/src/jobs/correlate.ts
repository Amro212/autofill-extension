export interface PendingJobContext {
  jobId: string;
  sourceTabId: number;
  applicationUrl?: string;
  company?: string;
  title?: string;
  capturedAt: string;
}

export interface ApplicationContext {
  tabId: number;
  openerTabId?: number;
  url: string;
  jobId?: string;
  company?: string;
  title?: string;
}

export type CorrelationResult =
  | { status: "matched"; jobId: string; confidence: "strong" }
  | { status: "ambiguous"; jobIds: string[] }
  | { status: "none" };

function sameText(left: string | undefined, right: string | undefined): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    left.trim().toLowerCase() === right.trim().toLowerCase()
  );
}

function sameHost(left: string | undefined, right: string): boolean {
  if (left === undefined) return false;
  try {
    return new URL(left).hostname === new URL(right).hostname;
  } catch {
    return false;
  }
}

export function correlateJobContext(
  pending: PendingJobContext[],
  application: ApplicationContext,
): CorrelationResult {
  const scored = pending
    .map((candidate) => {
      let score = 0;
      if (application.openerTabId === candidate.sourceTabId) score += 100;
      if (application.tabId === candidate.sourceTabId) score += 90;
      if (application.jobId === candidate.jobId) score += 80;
      if (candidate.applicationUrl === application.url) score += 70;
      else if (sameHost(candidate.applicationUrl, application.url)) score += 10;
      if (sameText(candidate.company, application.company)) score += 20;
      if (sameText(candidate.title, application.title)) score += 30;
      return { jobId: candidate.jobId, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  const first = scored[0];
  if (first === undefined) return { status: "none" };
  const second = scored[1];
  if (first.score >= 70 && (second === undefined || first.score - second.score >= 20)) {
    return { status: "matched", jobId: first.jobId, confidence: "strong" };
  }
  const contenders = scored.filter(({ score }) => first.score - score < 15);
  if (contenders.length > 1 || first.score >= 20) {
    return { status: "ambiguous", jobIds: contenders.map(({ jobId }) => jobId) };
  }
  return { status: "none" };
}
