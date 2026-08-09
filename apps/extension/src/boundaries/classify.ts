export type BoundaryType =
  | "none"
  | "captcha"
  | "assessment"
  | "video-interview"
  | "identity-verification"
  | "electronic-signature"
  | "legal-attestation";

export interface BoundaryClassification {
  type: BoundaryType;
  reason?: string;
}

function text(document: Document): string {
  return (document.body?.textContent ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function classifyBoundary(document: Document): BoundaryClassification {
  const content = text(document);
  if (
    document.querySelector(
      ".g-recaptcha, .h-captcha, [data-sitekey], iframe[src*='captcha'], iframe[title*='challenge' i]",
    ) !== null ||
    /verify (?:that )?you are human|security challenge|captcha/.test(content)
  ) {
    return { type: "captcha", reason: "Human verification requires user action" };
  }
  if (/identity verification|government (?:issued )?id|verify your identity/.test(content)) {
    return { type: "identity-verification", reason: "Identity verification requires user action" };
  }
  if (/electronic signature|e-signature|type your legal name|sign (?:this|the) document/.test(content)) {
    return { type: "electronic-signature", reason: "Electronic signature requires user action" };
  }
  if (
    /under penalty of perjury|i (?:certify|attest|declare) (?:that )?.*(?:true|accurate|complete)|legal (?:declaration|attestation)/.test(
      content,
    )
  ) {
    return { type: "legal-attestation", reason: "Legal attestation requires user action" };
  }
  if (/recorded video interview|video interview|record (?:your|a) response/.test(content)) {
    return { type: "video-interview", reason: "Video interview requires user action" };
  }
  if (
    /coding (?:assessment|challenge)|take-home assessment|timed (?:assessment|challenge)|psychometric|personality assessment/.test(
      content,
    )
  ) {
    return { type: "assessment", reason: "Assessment requires user action" };
  }
  return { type: "none" };
}

export function waitForCaptchaClear(
  document: Document,
  options: { timeoutMs?: number } = {},
): Promise<boolean> {
  if (classifyBoundary(document).type !== "captcha") return Promise.resolve(true);
  const timeoutMs = options.timeoutMs ?? 5 * 60_000;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      observer.disconnect();
      resolve(result);
    };
    const observer = new MutationObserver(() => {
      if (classifyBoundary(document).type !== "captcha") finish(true);
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}
