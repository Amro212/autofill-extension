// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { classifyPage } from "./index.js";

const fixture = readFileSync(
  resolve(process.cwd(), "tests/fixtures/classification.html"),
  "utf8",
);

describe("classifyPage", () => {
  it.each([
    "unrelated",
    "job-listing",
    "application",
    "review",
    "confirmation",
    "captcha",
    "boundary",
  ] as const)("classifies the %s fixture", (expected) => {
    document.documentElement.innerHTML = fixture;
    const template = document.querySelector<HTMLTemplateElement>(
      `template[data-case="${expected}"]`,
    )!;
    document.body.replaceChildren(template.content.cloneNode(true));

    expect(classifyPage(document).type).toBe(expected);
  });
});
