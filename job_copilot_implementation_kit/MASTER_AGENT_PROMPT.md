# Master Autonomous Coding Agent Prompt

You are the principal engineer responsible for autonomously building **Job Copilot**, a production-oriented AI browser extension that assists with job applications.

You are not being asked to write a proposal. You are responsible for implementing the working system.

Read every Markdown file in this implementation kit before making architecture decisions.

The kit is the source of truth.

---

## Mission

Build a cross-browser WebExtension that behaves like an AI job-application copilot.

It runs inside the user's normal browser and authenticated sessions.

It must detect job listings and application forms, maintain job/application context, fill arbitrary application fields using AI, upload documents, generate tailored resumes and cover letters, repair validation errors, progress through multi-page applications, and optionally submit after final validation.

The browser engine is not a blind macro.

Its loop is:

**OBSERVE -> UNDERSTAND -> DECIDE -> ACT -> VERIFY -> REPAIR**

Do not optimize for fake human behavior.

Do not implement fake typing cadence, fake mouse movement, random hesitation, stealth-browser code, CAPTCHA bypassing, fingerprint spoofing, or anti-bot evasion.

Any wait/delay exists because the page needs time to render, load options, upload, validate, or transition.

---

## Locked technology decisions

Browser:
- WXT
- React
- TypeScript
- WebExtension architecture
- Firefox/Zen first-class
- Chromium first-class
- separate WXT builds from one source tree

Backend:
- local Node.js + TypeScript service for v1
- Fastify preferred
- Zod validation
- SQLite behind repository abstraction
- Drizzle ORM is preferred unless investigation finds a clear blocker
- loopback-only by default
- authenticated pairing token is mandatory

Workspace:
- pnpm monorepo

AI:
- backend provider abstraction
- OpenRouter first
- model configurable
- initial default model target: Gemini 3.5 Flash Lite via OpenRouter
- verify the exact current OpenRouter slug during implementation before saving the default
- one primary model request per application page
- individual calls only for rewrite/repair/dynamic exceptions

UI:
- one persistent in-page command panel
- Shadow DOM
- contextual Rewrite controls beside AI-written narrative fields

Defaults:
- AI Autofill: ON once application workflow is explicitly started
- Auto Continue: ON
- Auto Submit: OFF
- Autopilot: OFF

Optional Autopilot:
- when enabled, confidently detected application forms may start automatically

---

## Scope

Everything below is v1 scope:

- job listing detection
- job-description capture
- cross-tab/cross-domain application correlation
- generic form discovery
- Workday
- Greenhouse
- Lever
- Ashby
- Oracle
- SAP SuccessFactors
- iCIMS
- Taleo
- Microsoft recruiting flows
- IBM recruiting flows where distinct
- multi-page applications
- SPA applications
- native and custom fields
- AI page answering
- answer memory
- rewrite with feedback
- validation detection
- self-repair
- automatic Continue/Next
- optional final Submit
- document library
- PDF/DOCX resume import
- resume parsing
- applicant profile
- resume tailoring
- PDF/DOCX tailored resume generation
- cover-letter generation
- PDF/DOCX cover-letter generation
- file upload
- application history
- debug mode
- debug bundle export
- cross-browser tests

Do not defer the AI document features. They are part of this build.

---

## Autonomous authority

You have authority to:

- inspect all project files
- create/delete/refactor files
- install appropriate dependencies
- run builds
- run tests
- launch local development servers
- use browser DevTools
- use Playwright for DEVELOPMENT/TESTING only
- inspect live public job/ATS pages when available
- capture safe local fixtures based on observed structures
- clone public reference repositories
- read their licenses
- adapt permissively licensed implementations
- commit stable milestones
- fix architecture as evidence requires

Playwright is allowed as a developer test tool.

It is NOT the runtime application automation architecture.

Do not ask the user to approve ordinary engineering decisions.

Stop only for a real external blocker that cannot be solved through repository inspection, browser inspection, testing, documentation, or available tools.

---

## Phase 0 is mandatory: source-code audit

Before implementing generic form primitives from scratch, inspect the donor repositories in `SOURCE_REUSE_AUDIT.md`.

Clone them into a gitignored `references/` directory or an external sibling directory.

For each useful module:
- identify exact path
- understand behavior
- inspect tests
- identify license
- decide port/adapt/reject
- record decision in `docs/reference-audit/`

The target composition is approximately:

```text
Our product
|
+-- architecture / field contracts / memory ideas
|      <- FormPilot
|
+-- generic arbitrary-page scanning and complex controls
|      <- AI Form Filler
|
+-- Workday / Greenhouse specialized field behavior
|      <- Job App Filler
|
+-- file upload/reference ATS behaviors
|      <- Autofill-Jobs
|
+-- sequential action philosophy
       <- Simplify public extension engineering material
```

Never assume a README claim means code exists.
Inspect the current source.

Never depend on reference repositories at runtime.

If code is reused, preserve required MIT/BSD notices and produce a `NOTICE.md`.

---

## Browser execution worlds

Use an isolated content script as the primary browser runtime.

Use a small page MAIN-world bridge only when actual site behavior requires it.

Keep secrets, resume content, applicant profile, backend tokens, and full AI context OUT of MAIN world.

The isolated content script should send narrow action commands to the page bridge.

Use current WXT-supported cross-browser injection patterns.

Verify Firefox/Zen and Chromium behavior instead of assuming parity.

---

## Applicant and AI truthfulness

The system should optimize the applicant strongly without fabricating resume experience.

Narrative answers:
- bridge related experience
- tailor to the role
- use concrete supported facts
- sound natural
- stay concise
- avoid generic filler

Do not invent:
- jobs
- projects
- tools
- certifications
- dates
- metrics
- leadership
- achievements
- years of experience

Structured factual fields:
1. explicit profile fact
2. resume/application evidence
3. relevant answer memory
4. if still unknown, product requirements permit a best-effort inference
5. mark inferred values internally

However, do not autonomously execute explicit electronic signatures, identity verification, or legally meaningful attestation flows without a user boundary.

The default Auto Submit setting is OFF, so normal operation ends with human review.

---

## Application initiation

Normal default:

```text
job detected
-> context captured
-> application linked
-> wait for user to click Autofill Application
-> autofill
-> validate/repair
-> auto-continue
-> repeat
-> stop at final review
```

Autopilot ON:

```text
confident application detected
-> automatically start autofill
-> validate/repair
-> continue
```

Auto Submit ON:

After final-page classification and verification, submit automatically unless a user boundary or unresolved validation issue exists.

---

## CAPTCHA / user boundaries

Do not solve or bypass CAPTCHA.

If CAPTCHA appears:
- enter AWAITING_CAPTCHA
- observe
- resume if it clears normally

Pause at:
- coding assessments
- psychometric/personality assessments
- video/recorded interviews
- identity verification
- electronic signatures
- explicit legal declaration/attestation screens

Surface the reason clearly in the panel.

---

## Job context

Run on job listing pages as well as ATS pages.

Capture before leaving the listing whenever possible:
- company
- role
- location
- job ID
- description
- responsibilities
- requirements
- preferred qualifications
- listing URL
- Apply/application URL
- ATS

When application opens another tab/domain, correlate it with the originating job.

Use explicit tab/opener knowledge first, then job ID/URL/company/title/recency.

If correlation is ambiguous, ask one small confirmation rather than silently attaching the wrong job.

---

## Form engine

Produce one serializable normalized field model independent of ATS.

Implement:
- text
- textarea
- email
- phone
- URL
- number
- date
- select
- radios
- checkboxes
- groups
- contenteditable
- rich-text
- custom comboboxes
- autocomplete
- async option lists
- multi-select
- custom date pickers
- file uploads
- previously uploaded-document selectors
- repeated work/education sections

Adapters enhance generic behavior.

Never disable generic fallback just because an ATS adapter is active.

---

## Form actions

Every field action is:

```text
locate
-> scroll into view
-> act through real rendered control
-> wait for page/framework reaction
-> read resulting state
-> verify
```

If verification fails:
- retry with a different appropriate strategy
- capture error
- optionally ask AI to repair semantic value
- bounded retries only

Do not mark an action successful merely because an event fired.

---

## Page-level AI

Normal page:

1. scan
2. normalize fields
3. load job context
4. load applicant profile
5. load resume facts
6. retrieve relevant global memory
7. retrieve application memory
8. send ONE structured request
9. validate JSON
10. fill
11. verify

Model response should identify fields only by supplied field IDs.

Never allow the model to invent DOM selectors or execute JavaScript.

AI output is data.

---

## Validation/self-repair

Before Continue:
- validate required controls
- inspect native validity
- inspect `aria-invalid`
- inspect visible errors
- inspect error summaries
- confirm uploads
- inspect disabled navigation controls

On failure:
- map error to field
- rescan
- repair
- verify
- retry Continue

Bound all retries.

If a required field remains unresolved:
- stop progression
- mark field failed
- explain in panel
- retain debug evidence

---

## Documents

Backend owns document storage and generation.

Implement:
- PDF import
- DOCX import
- structured resume representation
- applicant/profile extraction suggestions
- document library
- multiple resume variants
- transcripts
- generated tailored resumes
- generated cover letters
- PDF output
- DOCX output
- provenance

Do not edit resumes by brittle PDF text replacement.

Use a structured resume model and deterministic renderer.

Tailoring should select/reorder/rewrite only supported content.

Every generated fact must be traceable to applicant context.

---

## Resume tailoring behavior

For each target job:
- analyze job description
- score candidate experiences/projects/skills for relevance
- build a tailored content plan
- preserve identity, dates, employers, credentials
- rewrite bullets for relevance and clarity
- reorder skills/projects where useful
- preserve truthful metrics exactly
- generate final artifact
- associate it with application

Do not keyword-stuff unnaturally.

Do not make a resume worse for ATS readability.

---

## Cover-letter behavior

Use:
- job/company
- actual applicant experiences
- role requirements
- resume/profile
- previous high-quality reusable material where appropriate

Produce specific, concise letters.

No fabricated claims.

Persist generated artifact and source provenance.

---

## Control panel

One source-of-truth UI.

Required sections:

### Application
- company
- role
- ATS
- state
- current step
- detected fields
- filled fields
- failures
- selected documents

### Actions
- Autofill Application
- Scan
- Retry Failed
- Pause/Resume
- Undo

### Toggles
- AI Autofill
- Auto Continue
- Auto Submit
- Autopilot

### Profile
- applicant profile editor

### Documents
- library
- defaults
- generate tailored resume
- generate cover letter
- selected application documents

### Memory
- stored common answers
- application-specific answers

### Settings
- model/provider
- generation behavior
- retries
- document policies

### Debug
- adapter
- session ID
- field registry
- recent actions
- errors
- Export Debug Bundle

The UI is operational, not decorative.

---

## Error taxonomy

At minimum:

- BACKEND_OFFLINE
- BACKEND_UNPAIRED
- SESSION_CORRELATION_FAILED
- JOB_CONTEXT_MISSING
- FIELD_DISCOVERY_FAILED
- FIELD_ACTION_FAILED
- FIELD_VERIFICATION_FAILED
- FIELD_VALUE_REJECTED
- VALIDATION_FAILED
- NAVIGATION_FAILED
- UPLOAD_FAILED
- DOCUMENT_GENERATION_FAILED
- LLM_TIMEOUT
- LLM_PROVIDER_ERROR
- LLM_INVALID_RESPONSE
- CAPTCHA_WAIT
- USER_BOUNDARY

Surface errors without crashing the entire extension.

---

## Development method

For each subsystem:

```text
inspect evidence
-> design smallest stable contract
-> implement
-> unit test
-> integration test
-> browser test
-> verify real resulting state
-> document
-> commit
-> continue
```

Do not build all abstractions before a vertical slice works.

Get an early end-to-end path:

```text
job listing
-> capture
-> application
-> scan
-> mock AI
-> fill
-> verify
-> validate
-> continue
```

Then add live AI and advanced controls.

---

## Required documentation

Maintain:

- `docs/ARCHITECTURE.md`
- `docs/APPLICATION_STATE_MACHINE.md`
- `docs/FIELD_ENGINE.md`
- `docs/ATS_ADAPTERS.md`
- `docs/AI_PIPELINE.md`
- `docs/DOCUMENT_SYSTEM.md`
- `docs/SECURITY.md`
- `docs/DEBUGGING.md`
- `docs/REFERENCE_AUDIT.md`

For every ATS adapter document:
- detection signals
- current observed form structure
- fields
- custom controls
- repeatable sections
- uploads
- navigation
- validation
- known limitations
- test fixtures

---

## Tests

Use an LLM mock provider for normal automated tests.

Do not burn OpenRouter tokens on every run.

Browser fixtures must cover:
- React-controlled fields
- async comboboxes
- multi-step SPA
- upload
- validation rejection and repair
- final submission
- CAPTCHA wait
- user boundaries

Playwright is recommended for automated browser regression tests.

Again: Playwright is a test/development tool only, not the runtime automation layer.

---

## Git rules

Initialize Git immediately if needed.

Commit meaningful stable milestones.

Never commit:
- `.env`
- API keys
- pairing secrets
- actual applicant databases
- actual private resumes unless explicitly intended
- generated private application documents
- debug bundles containing personal data
- reference repository clones

Maintain proper license/NOTICE files for adapted third-party code.

---

## Completion

Do not declare completion because:
- extension loads
- UI renders
- one textarea fills
- mock AI works

Read and satisfy `TESTING_AND_ACCEPTANCE.md`.

At minimum the final system must demonstrate:
- Firefox/Zen
- Chromium
- localhost authenticated backend
- profile
- documents
- job capture
- cross-tab application context
- generic form filling
- current Workday behavior
- current Greenhouse behavior
- page AI
- rewrite
- answer memory
- validation repair
- multi-page auto-continue
- optional auto-submit
- file upload
- resume tailoring
- cover-letter generation
- boundary handling
- debug export

---

## Start now

1. Read this entire kit.
2. Inspect current workspace.
3. Preserve useful existing work.
4. Run Phase 0 source audit.
5. Create architecture docs.
6. Build Phase 1.
7. Keep progressing through `IMPLEMENTATION_PHASES.md`.
8. Run tests after every milestone.
9. Keep repository runnable.
10. Continue autonomously until acceptance criteria are met or a genuine external blocker exists.

Do not come back with another plan.

Build it.
