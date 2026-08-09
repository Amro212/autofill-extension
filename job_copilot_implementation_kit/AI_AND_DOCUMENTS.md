# AI and Document System

## 1. Provider abstraction

The extension never calls OpenRouter directly.

```ts
interface LLMProvider {
  answerApplicationPage(input: PageAnswerRequest): Promise<PageAnswerResult>;
  repairFields(input: FieldRepairRequest): Promise<FieldRepairResult>;
  rewriteField(input: RewriteRequest): Promise<RewriteResult>;
  tailorResume(input: ResumeTailorRequest): Promise<TailoredResumeResult>;
  generateCoverLetter(input: CoverLetterRequest): Promise<GeneratedDocumentResult>;
  classifyDocumentNeed?(input: DocumentNeedRequest): Promise<DocumentNeedResult>;
}
```

Implement OpenRouter first.

Model is user-configurable.

Initial default model target: **Gemini 3.5 Flash Lite via OpenRouter**.

The exact current OpenRouter slug must be verified during implementation and saved in configuration. Do not spread the slug through business logic or assume a stale identifier.

## 2. One primary AI request per page

For an ordinary application step:

```text
normalized fields
+ field constraints/options
+ current values
+ job context
+ applicant profile
+ resume facts
+ relevant global memory
+ application memory
          |
          v
       one AI call
          |
          v
structured field answers
```

Do not issue one LLM request per field during normal autofill.

Single-field calls are for:
- Rewrite
- repair after validation rejection
- genuinely new dynamically inserted field

## 3. Structured response

Keep it simple.

```ts
interface PageAnswerResult {
  answers: Array<{
    fieldId: string;
    value: string | number | boolean | string[];
    confidence?: number;
    inferred?: boolean;
    rationaleCode?: string;
  }>;
}
```

No long chain-of-thought.
No prose around JSON.

Validate with Zod.

## 4. Truthfulness policy

Optimize strongly for the applicant without inventing resume experience.

For subjective/narrative questions:
- bridge adjacent experience
- emphasize transferable work
- tailor to role/company
- stay believable
- never invent projects, jobs, technologies, credentials, dates, metrics, leadership, or achievements

For structured factual questions:
- use explicit applicant-profile facts first
- use resume/job/application evidence second
- if still unknown, the system may make a best-effort inference because the product requirement allows it
- mark inferred values internally
- retain the pre-submit review trail

Important safeguard:
Electronic signatures, identity declarations, and explicit legal-attestation flows are still user boundaries and are not autonomously executed.

Where a factual answer would amount to a legal attestation and there is no supporting profile evidence, do not silently convert a low-confidence guess into a legally meaningful autonomous action.

## 5. Applicant context

Maintain structured context independent of any one resume document.

```text
Applicant
|
+-- Identity
+-- Contact
+-- Education
+-- Employment
+-- Projects
+-- Skills
+-- Certifications
+-- Work eligibility
+-- Location/relocation
+-- Availability
+-- Salary preferences
+-- Links
+-- Custom facts
+-- Resume source records
```

The resume parser can suggest profile facts, but the structured profile remains editable.

## 6. Job context

Capture:
- company
- title
- location
- job ID
- description
- requirements
- responsibilities
- preferred qualifications
- posting URL
- ATS/application URL

Pass the normalized description into AI generation.

## 7. Answer memory

Two scopes.

### Global
Reusable applicant knowledge and strong generic answer material.

Examples:
- Python experience
- sponsorship patterns
- project summaries
- leadership examples
- why software engineering
- relocation preference

### Application
Company/role-specific context.

Examples:
- why this company
- role-specific motivation
- answers already given
- documents used
- current step history

Never reuse company-specific language blindly across employers.

## 8. Resume import

Support PDF and DOCX import in v1.

Pipeline:

```text
uploaded resume
    |
extract text/layout metadata
    |
LLM/structured parser
    |
ResumeSource + structured applicant/resume data
    |
user may edit
```

Do not treat extraction as infallible.

## 9. Resume tailoring

Resume tailoring is IN SCOPE.

The generator receives:
- source resume
- canonical applicant profile
- target job
- strict truthfulness constraints
- format/template selection
- length/page target
- optional user instructions

Tailoring may:
- reorder bullets
- select stronger relevant bullets
- rewrite wording
- emphasize relevant projects/skills
- adjust summary if template has one
- alter skills ordering
- remove less relevant material

Tailoring may NOT:
- invent experience
- invent metrics
- add technologies not supported by applicant context
- change employment dates
- create fake responsibilities
- create fake certifications

Persist:
- source document ID
- generated document ID
- job/application ID
- generation prompt version
- timestamp

## 10. Resume rendering

Do not modify PDFs by brittle string replacement.

Use a structured resume representation and deterministic renderer.

Recommended output support:
- PDF
- DOCX

Reasonable libraries may include:
- `@react-pdf/renderer` or another deterministic Node PDF renderer
- `docx` for DOCX

The agent should benchmark the chosen rendering path and ensure generated resumes remain ATS-readable.

Keep templates simple, single-column by default, text-based, no rasterized resume pages.

## 11. Cover letters

Cover-letter generation is IN SCOPE.

Inputs:
- job description
- applicant profile
- source resume
- selected relevant experiences/projects
- company/role
- style settings
- optional prior letter

Output:
- structured text
- PDF and/or DOCX artifact
- metadata
- application association

Tone:
- concise
- specific
- human
- evidence-based
- not generic
- no fabricated claims

## 12. Document library

```text
Documents
|
+-- Resumes
|   +-- Original
|   +-- Software
|   +-- AI
|   +-- Embedded
|   +-- Tailored/<application>
|
+-- Cover Letters
|   +-- Generated/<application>
|
+-- Transcripts
|
+-- Other
```

Document metadata:

```ts
interface DocumentRecord {
  id: string;
  userId: string;
  type: "resume" | "cover-letter" | "transcript" | "other";
  name: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  sourceDocumentId?: string;
  applicationId?: string;
  tags: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 13. Document strategy per application

Before upload:
1. identify requested document type
2. inspect job context
3. evaluate existing suitable documents
4. if configured to tailor and this is a resume/cover letter, generate appropriate document
5. associate selected/generated artifact with application
6. upload
7. verify accepted state

Expose settings:
- always use default resume
- auto-select best existing resume
- auto-generate tailored resume
- auto-generate cover letter when requested
- ask before generation (optional)

Recommended default:
- auto-select/tailor resume when application requires resume
- generate cover letter only when a cover letter is requested or optional and user has enabled optional-cover-letter generation
