import type { PageAnswerRequest, PageAnswerResult } from "@job-copilot/contracts";

import { classifyBoundary, waitForCaptchaClear } from "../../../src/boundaries/classify.js";
import { discoverFields } from "../../../src/fields/discover.js";
import { NormalizedFieldRegistry } from "../../../src/fields/registry.js";
import { FillController } from "../../../src/fill/controller.js";
import { NavigationController } from "../../../src/navigation/controller.js";
import { uploadFile } from "../../../src/uploads/controller.js";
import { inspectValidation } from "../../../src/validation/inspect.js";
import { ValidationRepairController } from "../../../src/validation/repair.js";

const app = document.querySelector<HTMLElement>("#app")!;
const registry = new NormalizedFieldRegistry();
let answerCalls = 0;

function setStep(step: string, html: string): void {
  document.body.dataset.step = step;
  app.innerHTML = html;
}

function renderCity(): void {
  setStep(
    "city",
    `<h1>Application</h1>
     <form>
       <label for="city">City</label>
       <input id="city" name="city" required aria-describedby="city-error">
       <div id="city-error" role="alert"></div>
       <button id="city-continue" type="button" disabled>Continue</button>
     </form>`,
  );
  const input = document.querySelector<HTMLInputElement>("#city")!;
  const error = document.querySelector<HTMLElement>("#city-error")!;
  const button = document.querySelector<HTMLButtonElement>("#city-continue")!;
  input.addEventListener("input", () => {
    const accepted = input.value === "Toronto";
    input.setAttribute("aria-invalid", String(!accepted));
    error.textContent = accepted ? "" : "Enter the full city name";
    button.disabled = !accepted;
  });
  button.addEventListener("click", renderUpload);
}

function renderUpload(): void {
  setStep(
    "upload",
    `<h1>Documents</h1>
     <form>
       <label for="resume">Resume</label>
       <input id="resume" type="file" accept=".pdf,application/pdf" hidden>
       <output id="resume-name"></output>
       <button id="upload-continue" type="button" disabled>Continue</button>
     </form>`,
  );
  const input = document.querySelector<HTMLInputElement>("#resume")!;
  input.addEventListener("change", () => {
    document.querySelector("#resume-name")!.textContent = input.files?.[0]?.name ?? "";
    document.querySelector<HTMLButtonElement>("#upload-continue")!.disabled = false;
  });
  document.querySelector("#upload-continue")!.addEventListener("click", renderReview);
}

function renderReview(): void {
  setStep(
    "review",
    `<h1>Review application</h1>
     <p>City: Toronto</p>
     <p>Resume: <output id="resume-name">resume.pdf</output></p>
     <button id="submit" type="submit">Submit application</button>`,
  );
  document.querySelector("#submit")!.addEventListener("click", renderConfirmation);
}

function renderConfirmation(): void {
  setStep("confirmation", "<h1>Application received</h1>");
}

async function answerPage(_request: PageAnswerRequest): Promise<PageAnswerResult> {
  answerCalls += 1;
  const fieldId = registry.list()[0]?.id;
  return {
    answers: fieldId === undefined
      ? []
      : [{ fieldId, value: answerCalls === 1 ? "TO" : "Toronto" }],
  };
}

function navigator(expectedStep: string): NavigationController {
  return new NavigationController({
    inspectValidation: () => inspectValidation(document, registry),
    waitForTransition: async () => {
      await Promise.resolve();
      return document.body.dataset.step !== expectedStep;
    },
  });
}

const boundaryHtml = {
  assessment: "<h1>Coding assessment</h1><p>Timed challenge</p>",
  "video-interview": "<h1>Recorded video interview</h1>",
  "identity-verification": "<h1>Identity verification</h1><p>Upload government ID</p>",
  "electronic-signature": "<h1>Electronic signature</h1><p>Type your legal name</p>",
  "legal-attestation": "<h1>Legal attestation</h1><p>I certify that this is true</p>",
} as const;

type BoundaryFixture = keyof typeof boundaryHtml;

window.automationHarness = {
  async run(autoSubmit: boolean) {
    answerCalls = 0;
    renderCity();
    registry.reconcile(discoverFields(document, "city"));
    const fill = new FillController({
      registry,
      client: {
        answerPage,
        async rewriteField() {
          throw new Error("Not used by this fixture");
        },
      },
    });
    await fill.fillPage({ pageKey: "city", applicationId: "fixture-application" });
    const repair = new ValidationRepairController({ registry, answerPage });
    const repaired = await repair.repairPage(document, {
      pageKey: "city",
      applicationId: "fixture-application",
    });
    await navigator("city").advance(document, {
      autoContinue: true,
      autoSubmit,
      pageType: "application",
    });

    const input = document.querySelector<HTMLInputElement>("#resume")!;
    const upload = await uploadFile(
      input,
      new File(["%PDF-fixture"], "resume.pdf", { type: "application/pdf" }),
      {
        acceptedState: () =>
          document.querySelector("#resume-name")?.textContent === "resume.pdf",
      },
    );
    await navigator("upload").advance(document, {
      autoContinue: true,
      autoSubmit,
      pageType: "application",
    });
    registry.reconcile([]);
    const final = await navigator("review").advance(document, {
      autoContinue: true,
      autoSubmit,
      pageType: "review",
    });
    return {
      repairAttempts: repaired.aiAttempts,
      uploaded: upload.ok,
      finalStatus: final.status,
      step: document.body.dataset.step,
    };
  },

  async waitThroughCaptcha() {
    let clicks = 0;
    setStep("captcha", '<div class="h-captcha"><button>Verify</button></div>');
    document.querySelector("button")!.addEventListener("click", () => {
      clicks += 1;
    });
    const waiting = waitForCaptchaClear(document, { timeoutMs: 1_000 });
    setTimeout(() => document.querySelector(".h-captcha")?.remove(), 10);
    return { cleared: await waiting, clicks };
  },

  async checkBoundary(type: BoundaryFixture) {
    let clicks = 0;
    setStep(type, `${boundaryHtml[type]}<button type="button">Continue</button>`);
    document.querySelector("button")!.addEventListener("click", () => {
      clicks += 1;
    });
    const classification = classifyBoundary(document);
    const navigation = await navigator(type).advance(document, {
      autoContinue: true,
      autoSubmit: true,
      pageType: "boundary",
    });
    return { type: classification.type, navigation: navigation.status, clicks };
  },
};

declare global {
  interface Window {
    automationHarness: {
      run(autoSubmit: boolean): Promise<{
        repairAttempts: number;
        uploaded: boolean;
        finalStatus: string;
        step?: string;
      }>;
      waitThroughCaptcha(): Promise<{ cleared: boolean; clicks: number }>;
      checkBoundary(type: BoundaryFixture): Promise<{
        type: string;
        navigation: string;
        clicks: number;
      }>;
    };
  }
}
