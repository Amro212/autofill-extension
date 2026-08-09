export interface ExtractedJob {
  company?: string;
  title?: string;
  location?: string;
  jobId?: string;
  descriptionRaw?: string;
  descriptionNormalized?: string;
  listingUrl: string;
  applicationUrl?: string;
  ats?: string;
}

type JsonObject = Record<string, unknown>;

function normalize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized === "" ? undefined : normalized;
}

function textFromHtml(document: Document, value: unknown): string | undefined {
  const source = normalize(value);
  if (source === undefined) return undefined;
  const container = document.createElement("div");
  container.innerHTML = source;
  return normalize(container.textContent);
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function findJobPosting(value: unknown): JsonObject | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const record = object(value);
  if (record === undefined) return undefined;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (types.includes("JobPosting")) return record;
  return findJobPosting(record["@graph"]);
}

function readStructuredJob(document: Document): JsonObject | undefined {
  for (const script of document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  )) {
    try {
      const found = findJobPosting(JSON.parse(script.textContent ?? ""));
      if (found !== undefined) return found;
    } catch {
      // Ignore malformed third-party structured data and continue to DOM evidence.
    }
  }
  return undefined;
}

function locationFromStructured(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const address = object(object(first)?.address);
  return [address?.addressLocality, address?.addressRegion, address?.addressCountry]
    .map(normalize)
    .filter((part): part is string => part !== undefined)
    .join(", ") || undefined;
}

function detectAts(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const host = new URL(url).hostname.toLowerCase();
  const matches: Array<[RegExp, string]> = [
    [/greenhouse\.io$/, "greenhouse"],
    [/myworkdayjobs\.com$/, "workday"],
    [/lever\.co$/, "lever"],
    [/ashbyhq\.com$/, "ashby"],
    [/icims\.com$/, "icims"],
  ];
  return matches.find(([pattern]) => pattern.test(host))?.[1];
}

function text(document: Document, selector: string): string | undefined {
  return normalize(document.querySelector(selector)?.textContent);
}

function atsJobEvidence(
  document: Document,
  listingUrl: URL,
  ats: string | undefined,
): { title?: string; jobId?: string; location?: string } {
  if (ats === "workday") {
    const jobId = listingUrl.pathname.match(/_([^/]+)(?:\/apply(?:\/|$)|$)/)?.[1];
    const title = text(
      document,
      "[data-automation-id='jobTitleHeading'], [data-automation-id='jobPostingHeader'] h2",
    );
    const location = text(document, "[data-automation-id='locations']");
    return {
      ...(title === undefined ? {} : { title }),
      ...(jobId === undefined ? {} : { jobId }),
      ...(location === undefined ? {} : { location }),
    };
  }
  if (ats === "greenhouse") {
    const jobId = listingUrl.pathname.match(/\/jobs\/(\d+)/)?.[1];
    const title = text(document, "main h1, h1");
    const location = text(document, "[class*='location'], [data-testid='location']");
    return {
      ...(title === undefined ? {} : { title }),
      ...(jobId === undefined ? {} : { jobId }),
      ...(location === undefined ? {} : { location }),
    };
  }
  return {};
}

export function extractJob(document: Document, listingUrl: URL): ExtractedJob {
  const structured = readStructuredJob(document);
  const applyAnchor = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find(
    (anchor) => /apply/i.test(anchor.textContent ?? "") || /apply/.test(anchor.href),
  );
  const applicationUrl = applyAnchor
    ? new URL(applyAnchor.getAttribute("href")!, listingUrl).href
    : undefined;
  const ats = detectAts(applicationUrl ?? listingUrl.href);
  const adapterEvidence = atsJobEvidence(document, listingUrl, ats);
  const descriptionRaw =
    normalize(structured?.description) ??
    text(document, "#job-description, [data-job-description], [itemprop='description']");
  const identifier = object(structured?.identifier);
  const hiringOrganization = object(structured?.hiringOrganization);
  return {
    ...(normalize(structured?.title) ?? adapterEvidence.title ?? text(document, "h1")
      ? {
          title:
            normalize(structured?.title) ?? adapterEvidence.title ?? text(document, "h1"),
        }
      : {}),
    ...(normalize(hiringOrganization?.name) ?? text(document, "[data-company], [itemprop='hiringOrganization']")
      ? {
          company:
            normalize(hiringOrganization?.name) ??
            text(document, "[data-company], [itemprop='hiringOrganization']"),
        }
      : {}),
    ...(locationFromStructured(structured?.jobLocation) ?? adapterEvidence.location ?? text(document, "[data-location], [itemprop='jobLocation']")
      ? {
          location:
            locationFromStructured(structured?.jobLocation) ??
            adapterEvidence.location ??
            text(document, "[data-location], [itemprop='jobLocation']"),
        }
      : {}),
    ...(normalize(identifier?.value) ?? adapterEvidence.jobId
      ? { jobId: normalize(identifier?.value) ?? adapterEvidence.jobId }
      : {}),
    ...(descriptionRaw === undefined ? {} : { descriptionRaw }),
    ...(descriptionRaw === undefined
      ? {}
      : { descriptionNormalized: textFromHtml(document, descriptionRaw) }),
    listingUrl: listingUrl.href,
    ...(applicationUrl === undefined ? {} : { applicationUrl }),
    ...(ats === undefined ? {} : { ats }),
  } as ExtractedJob;
}
