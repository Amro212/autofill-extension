# Job Copilot v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and verify the complete Job Copilot v1 defined by the implementation kit.

**Architecture:** A pnpm monorepo separates a WXT/React WebExtension from a loopback-only Fastify service. Shared packages own serializable Zod contracts and deterministic domain logic; browser DOM references stay local, provider credentials and documents stay behind authenticated backend APIs.

**Tech Stack:** pnpm, TypeScript, WXT, React, Fastify, Zod, SQLite/Drizzle, Vitest, Playwright, OpenRouter provider abstraction, `docx`, and a deterministic text-based PDF renderer.

---

## Execution rules

- Follow `job_copilot_implementation_kit/` as source of truth.
- Use TDD for each behavior: failing focused test, minimal implementation, passing focused test, then broader suite.
- Keep `references/`, runtime `data/`, secrets, private documents, and debug exports ignored.
- Commit only verified stable milestones; never commit donor clones or secrets.
- Do not mark an ATS supported without its documented fixture matrix.

### Task 1: Mandatory donor source audit

**Files:**
- Create: `.gitignore`
- Create: `docs/reference-audit/{form-pilot,ai-form-filler,job-app-filler,autofill-jobs,job-autofiller,simplify-extension-take-home}.md`
- Create: `docs/REFERENCE_AUDIT.md`
- Inspect: `references/*`

**Steps:**
1. Ignore `references/`, `data/`, build output, environment secrets, uploaded/generated documents, and debug bundles.
2. Clone every repository named in `SOURCE_REUSE_AUDIT.md` into `references/`.
3. Inspect exact requested source paths, tests, current registries, and license files.
4. Record behavior, browser assumptions, test evidence, port/adapt/reject decisions, and attribution needs per donor.
5. Run `git status --short`; confirm no donor clone appears.
6. Commit audit documentation.

### Task 2: Workspace and executable contracts

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.env.example`
- Create: `packages/contracts/src/{index,fields,applications,api,ai,documents,errors}.ts`
- Create: `packages/application-core/src/{index,state-machine}.ts`
- Create: `packages/*/package.json`, `packages/*/tsconfig.json`
- Test: `packages/contracts/src/*.test.ts`, `packages/application-core/src/state-machine.test.ts`

**Steps:**
1. Write failing tests for field schemas, API error envelopes, defaults, and legal/illegal state transitions.
2. Run focused Vitest tests; expect missing modules/failures.
3. Add workspace config and minimal Zod/domain implementations.
4. Run focused tests, typecheck, and workspace test; expect pass.
5. Commit contracts/state-machine milestone.

### Task 3: Paired loopback service and WXT shells

**Files:**
- Create: `apps/server/src/{app,server}.ts`
- Create: `apps/server/src/auth/{installation,pairing,guard}.ts`
- Create: `apps/server/src/api/{health,pair}.ts`
- Create: `apps/extension/{wxt.config,package}.ts`
- Create: `apps/extension/entrypoints/{background,content}.ts{x,}`
- Create: `apps/extension/src/api/client.ts`
- Test: `apps/server/test/{health,pairing}.test.ts`, `apps/extension/src/api/client.test.ts`

**Steps:**
1. Write failing tests: health is public, protected route rejects unpaired calls, pairing returns/accepts scoped token, server listens on loopback config.
2. Implement Fastify app factory, installation identity, hashed token storage, auth guard, restrictive CORS, and redaction.
3. Scaffold WXT targets, background messaging, isolated content shell, and extension API client/token storage.
4. Verify server tests, Firefox build, Chromium build, and extension-to-health integration.
5. Commit runnable paired skeleton.

### Task 4: SQLite repositories, profile, and settings

**Files:**
- Create: `apps/server/src/db/{client,schema,migrate}.ts`
- Create: `apps/server/src/repositories/{profile,settings,jobs,applications}.ts`
- Create: `apps/server/src/api/{profile,settings}.ts`
- Create: `apps/extension/src/ui/{Panel,Profile,Settings}.tsx`
- Test: repository/API/UI tests beside implementations

**Steps:**
1. Write failing persistence and payload-validation tests using temporary databases.
2. Implement Drizzle schema/migrations and repository abstractions.
3. Implement authenticated CRUD routes.
4. Mount one Shadow DOM panel with connection state and locked default toggles.
5. Verify restart persistence and UI editing through integration tests.
6. Commit profile/persistence milestone.

### Task 5: Secure document library

**Files:**
- Create: `apps/server/src/documents/{storage,metadata,import,stream}.ts`
- Create: `apps/server/src/api/documents.ts`
- Create: `apps/extension/src/ui/Documents.tsx`
- Test: `apps/server/test/documents.test.ts`

**Steps:**
1. Write failing tests for PDF/DOCX acceptance, size/MIME limits, filename sanitation, opaque IDs, traversal rejection, defaults, and streaming.
2. Implement filesystem abstraction and document repository with configured-root containment.
3. Add authenticated upload/list/default/stream endpoints and extension UI.
4. Verify files round-trip without accepting client filesystem paths.
5. Commit document-library milestone.

### Task 6: Observation, classification, job capture, and sessions

**Files:**
- Create: `apps/extension/src/observer/{mutations,routes}.ts`
- Create: `apps/extension/src/page-classifier/index.ts`
- Create: `apps/extension/src/jobs/{extract,correlate}.ts`
- Create: `apps/extension/src/sessions/controller.ts`
- Test: unit tests plus `apps/extension/tests/fixtures/classification.html`

**Steps:**
1. Write failing tests for debounced mutation batches, SPA URL changes, all page classes, normalized job extraction, strong/ambiguous correlation, and reload recovery.
2. Implement smallest pure classifiers/extractors before DOM orchestration.
3. Persist jobs/sessions through backend and tab mapping through background.
4. Verify listing-to-new-tab fixture retains job context and ambiguity surfaces one-line confirmation.
5. Commit observation/session milestone.

### Task 7: Generic field discovery and normalized registry

**Files:**
- Create: `packages/field-core/src/{labels,normalize,options,signatures}.ts`
- Create: `apps/extension/src/fields/{discover,registry}.ts`
- Create: `apps/extension/tests/fixtures/fields/*`
- Test: colocated unit tests and Playwright discovery spec

**Steps:**
1. Encode fixture expectations for all field kinds, evidence ordering, requirements, groups, async options, repeats, and dedupe.
2. Port only audited donor algorithms compatible with normalized contracts; preserve attribution where needed.
3. Implement ATS-enhanced plus generic fallback cascade.
4. Verify dynamic insertion/removal and no duplicate logical fields.
5. Commit field-discovery milestone.

### Task 8: Field execution, verification, undo, and bridge security

**Files:**
- Create: `apps/extension/src/bridge/{protocol,inject,main-world}.ts`
- Create: `apps/extension/src/fields/{execute,verify,undo}.ts`
- Create: `apps/extension/tests/fixtures/execution/*`
- Test: unit and Playwright execution specs

**Steps:**
1. Write failing real-state tests for native/React text, selects, radios, checkboxes, contenteditable, comboboxes, autocomplete, dates, rerenders, scroll, and undo.
2. Implement per-page channel validation and narrow action schema with no secrets/profile payloads.
3. Implement locate/scroll/act/wait/read/verify and exact-before-fuzzy matching with bounded alternatives.
4. Verify framework reconciliation and actual widget state, not emitted events.
5. Commit execution milestone.

### Task 9: AI provider, page answer pipeline, rewrite, and memory

**Files:**
- Create: `packages/ai-core/src/{provider,prompts,validation}.ts`
- Create: `apps/server/src/ai/{service,mock-provider,openrouter-provider}.ts`
- Create: `apps/server/src/memory/{signature,ranking,repository}.ts`
- Create: `apps/extension/src/fill/controller.ts`
- Test: provider/schema/memory/integration tests

**Steps:**
1. Write failing tests for one request per page, valid field IDs/options/types, prompt separation, malformed response repair, bounded retries, rewrite, and employer-safe memory ranking.
2. Implement deterministic mock provider and page pipeline first.
3. Verify current OpenRouter model slug from official/provider data and store only in config.
4. Implement OpenRouter behind interface, opt-in live test, rewrite endpoint, and answer provenance/memory.
5. Verify mock job-to-page autofill, rewrite-one-field, and undo end to end.
6. Commit AI/memory milestone.

### Task 10: Validation repair, navigation, uploads, and boundaries

**Files:**
- Create: `apps/extension/src/validation/{inspect,repair}.ts`
- Create: `apps/extension/src/navigation/{classify,controller}.ts`
- Create: `apps/extension/src/uploads/controller.ts`
- Create: `apps/extension/src/boundaries/classify.ts`
- Create: matching fixtures and Playwright specs

**Steps:**
1. Write failing fixtures for rejected first answers, disabled continue, SPA transitions, review/submit, standard/hidden upload, CAPTCHA disappearance, and each user boundary.
2. Implement native/ARIA/site error mapping, local repair, AI repair, and reasoned retry budgets.
3. Implement verified Continue/Review/Submit transitions respecting toggle defaults.
4. Implement DataTransfer/File upload plus accepted-state verification.
5. Implement CAPTCHA observe-only resume and hard user-boundary pauses.
6. Verify entire mock multi-step application under both auto-submit modes.
7. Commit automation-loop milestone.

### Task 11: Resume import, tailoring, cover letters, and strategy

**Files:**
- Create: `packages/document-core/src/{resume,truthfulness,render}.ts`
- Create: `apps/server/src/documents/{parse,tailor,cover-letter,strategy}.ts`
- Create: `apps/server/src/generation/{pdf,docx}.ts`
- Test: parser, provenance, truthfulness, renderer, and workflow tests

**Steps:**
1. Write failing tests for PDF/DOCX extraction, unsupported section retention, canonical representation, fact provenance, unsupported claim rejection, and text-selectable outputs.
2. Implement extractors and editable canonical resume mapping suggestions.
3. Implement relevance plan and provider-backed tailoring guarded by source fact IDs.
4. Implement concise evidence-based cover letters.
5. Render deterministic ATS-readable PDF/DOCX and persist complete provenance.
6. Integrate document selection/generation with verified uploads.
7. Commit AI-document milestone.

### Task 12: ATS adapters and evidence

**Files:**
- Create: `packages/ats-core/src/contracts.ts`
- Create: `apps/extension/src/adapters/{workday,greenhouse,lever,ashby,oracle,successfactors,icims,taleo,microsoft,ibm}/`
- Create: `docs/ATS_ADAPTERS.md` and per-adapter docs/fixtures/tests

**Steps:**
1. Inspect current accessible structures and donor evidence before each adapter.
2. Record detection, controls, repeats, uploads, navigation, validation, and limitations.
3. Write failing regression fixtures for required support matrix.
4. Implement only adapter-specific enhancements; retain generic fallback.
5. Run each complete adapter matrix before marking supported.
6. Commit adapters in independently verified milestones.

### Task 13: Debugging, cross-browser hardening, and release acceptance

**Files:**
- Create/update: `docs/{ARCHITECTURE,APPLICATION_STATE_MACHINE,FIELD_ENGINE,ATS_ADAPTERS,AI_PIPELINE,DOCUMENT_SYSTEM,SECURITY,DEBUGGING,REFERENCE_AUDIT}.md`
- Create: `apps/extension/src/debug/export.ts`
- Create: root `README.md`, `NOTICE.md`, release/setup scripts

**Steps:**
1. Add structured redacted logs, action journal views, snapshots, adapter/session metadata, and explicit sanitized debug export.
2. Run unit and integration suites, all browser fixtures, both WXT production builds, and backend startup smoke test.
3. Smoke test Firefox/Zen and Chromium execution-world injection, localhost auth, uploads, navigation, and lifecycle recovery.
4. Check every item in `TESTING_AND_ACCEPTANCE.md`; retain evidence and do not waive failures.
5. Complete setup, privacy/security, migration, backup/export, license, and attribution docs.
6. Commit release candidate only after full verification.
