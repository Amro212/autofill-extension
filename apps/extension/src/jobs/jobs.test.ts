// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { correlateJobContext } from "./correlate.js";
import { extractJob } from "./extract.js";

describe("extractJob", () => {
  it("prefers normalized JobPosting JSON-LD and retains the apply URL", () => {
    document.head.innerHTML = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "  Senior   Engineer ",
      hiringOrganization: { name: " Example Corp " },
      jobLocation: { address: { addressLocality: "Toronto", addressRegion: "ON" } },
      identifier: { value: "JOB-42" },
      description: "<p>Build reliable systems.</p>",
    })}</script>`;
    document.body.innerHTML = `<a href="https://boards.greenhouse.io/example/jobs/42">Apply now</a>`;

    expect(extractJob(document, new URL("https://example.test/jobs/42"))).toMatchObject({
      title: "Senior Engineer",
      company: "Example Corp",
      location: "Toronto, ON",
      jobId: "JOB-42",
      descriptionNormalized: "Build reliable systems.",
      listingUrl: "https://example.test/jobs/42",
      applicationUrl: "https://boards.greenhouse.io/example/jobs/42",
      ats: "greenhouse",
    });
  });

  it("falls back to semantic DOM evidence", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<main><h1>Data Scientist</h1><p data-company>Acme</p><p data-location>Remote</p><section id="job-description">Analyze data.</section><a href="/apply">Apply</a></main>`;
    expect(extractJob(document, new URL("https://acme.test/jobs/data"))).toMatchObject({
      title: "Data Scientist",
      company: "Acme",
      location: "Remote",
      descriptionNormalized: "Analyze data.",
      applicationUrl: "https://acme.test/apply",
    });
  });
});

describe("correlateJobContext", () => {
  const recent = "2026-08-09T01:00:00.000Z";
  const pending = [
    {
      jobId: "job-1",
      sourceTabId: 10,
      applicationUrl: "https://apply.example.test/job/1",
      company: "Example Corp",
      title: "Engineer",
      capturedAt: recent,
    },
    {
      jobId: "job-2",
      sourceTabId: 20,
      applicationUrl: "https://apply.example.test/job/2",
      company: "Example Corp",
      title: "Designer",
      capturedAt: recent,
    },
  ];

  it("uses explicit opener knowledge as a strong correlation", () => {
    expect(
      correlateJobContext(pending, {
        tabId: 30,
        openerTabId: 10,
        url: "https://apply.example.test/start",
      }),
    ).toEqual({ status: "matched", jobId: "job-1", confidence: "strong" });
  });

  it("retains context when a listing navigates to an application in the same tab", () => {
    expect(
      correlateJobContext(pending, {
        tabId: 10,
        url: "https://different-ats.example/apply",
      }),
    ).toEqual({ status: "matched", jobId: "job-1", confidence: "strong" });
  });

  it("surfaces ambiguity instead of silently choosing", () => {
    expect(
      correlateJobContext(pending, {
        tabId: 30,
        url: "https://apply.example.test/start",
        company: "Example Corp",
      }),
    ).toEqual({ status: "ambiguous", jobIds: ["job-1", "job-2"] });
  });
});
