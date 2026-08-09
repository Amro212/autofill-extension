# Implementation Phases

The coding agent works continuously through these phases.

Do not stop after planning or scaffolding.

## Phase 0 - Source audit and evidence collection

Clone/read the reference repositories listed in `SOURCE_REUSE_AUDIT.md`.

Create:
`docs/reference-audit/`

For each donor:
- relevant paths
- license
- useful algorithms
- browser assumptions
- code worth porting
- code to avoid
- test coverage
- attribution requirements

Do not copy before understanding.

## Phase 1 - Monorepo and contracts

Deliver:
- pnpm workspace
- WXT extension app
- Node/TypeScript server
- shared contracts package
- lint/typecheck/test commands
- environment templates
- `.gitignore`
- runnable hello-world extension and `/health`

Acceptance:
- Firefox build succeeds
- Chromium build succeeds
- backend starts
- extension can reach backend health endpoint

## Phase 2 - Pairing/security foundation

Deliver:
- backend installation identity
- pairing token flow
- extension token storage
- authenticated requests
- strict loopback binding
- CORS/origin policy
- secret redaction

Acceptance:
- unpaired request denied
- paired request succeeds
- token never exposed to page world

## Phase 3 - Persistence + profile

Deliver:
- SQLite schema/migrations
- Drizzle repositories
- user record
- applicant profile CRUD
- settings CRUD
- control-panel profile UI

Acceptance:
- profile survives restarts
- data can be edited through extension UI

## Phase 4 - Document library

Deliver:
- upload/import
- metadata
- filesystem storage abstraction
- resume/transcript/cover-letter categories
- content streaming endpoint
- extension document UI

Acceptance:
- PDF/DOCX stored/retrieved
- no path traversal
- default documents selectable

## Phase 5 - Extension runtime + control panel

Deliver:
- isolated content script
- background/service worker
- Shadow DOM panel
- browser messaging
- MAIN-world bridge
- connection indicator
- settings:
  - AI Autofill
  - Auto Continue
  - Auto Submit
  - Autopilot

Acceptance:
- panel works on arbitrary HTTP(S) page
- no host layout breakage
- Firefox + Chromium smoke tested

## Phase 6 - Observer and page classifier

Deliver:
- MutationObserver
- SPA route detection
- navigation awareness
- debounced incremental scans
- page types:
  - unrelated
  - job listing
  - application
  - review
  - confirmation
  - CAPTCHA
  - boundary

Acceptance:
- fixtures dynamically insert/remove fields
- classifier updates without reload

## Phase 7 - Job capture + cross-tab correlation

Deliver:
- generic job extractor
- structured job record
- Apply-link interception/context capture where appropriate
- tab/session correlation
- recent pending job logic

Acceptance:
- job listing -> ATS new tab retains context
- ambiguous correlation requests minimal confirmation

## Phase 8 - Application state machine

Deliver:
- persisted state transitions
- recovery after reload
- SPA transitions
- session journal

Acceptance:
- multi-step fixture survives reload/navigation
- state cannot make illegal transition silently

## Phase 9 - Generic field discovery

Port/adapt strongest patterns from AI Form Filler and FormPilot.

Deliver:
- label extraction
- required detection
- native inputs
- textarea
- select
- radio
- checkbox
- contenteditable
- combobox detection
- date-picker detection
- options harvesting
- dedupe/normalization

Acceptance:
- fixture suite normalized correctly
- no duplicate logical fields

## Phase 10 - Field execution and verification

Deliver:
- native setter utilities
- event dispatch
- main-world executor
- scroll-into-view
- native select
- radio/checkbox
- combobox
- autocomplete
- date
- contenteditable
- snapshots/undo
- post-action verification

Acceptance:
- React-controlled fixture keeps values after rerender
- custom controls update actual page state

## Phase 11 - OpenRouter and page answering

Deliver:
- provider abstraction
- OpenRouter provider
- configurable model
- Zod structured response
- one request per page
- test/mock provider
- retry/repair of malformed responses

Acceptance:
- mock deterministic page fill
- live provider opt-in test
- no secret in extension/page

## Phase 12 - AI filling UX

Deliver:
- detected field list
- Fill action
- progress statuses
- highlights
- Rewrite control + feedback
- undo
- answer source metadata

Acceptance:
- user can autofill, inspect, rewrite one field, undo

## Phase 13 - Answer memory

Deliver:
- normalized question signature
- page/application memory
- global candidate answers
- usage tracking
- domain/application context
- AI memory retrieval

Acceptance:
- repeated question on another fixture can reuse appropriate candidate
- employer-specific text is not blindly copied

## Phase 14 - Validation/self-repair

Deliver:
- native validity inspection
- aria-invalid
- site error extraction
- local repair
- AI repair request
- bounded retries
- UI errors

Acceptance:
- fixture intentionally rejects first answer
- engine fixes/retries and records why

## Phase 15 - Automatic navigation

Deliver:
- Next/Continue/Review classification
- verify-before-click
- transition observer
- navigation retry
- final Submit classification

Acceptance:
- multi-step fixture completes through review
- Auto Submit OFF stops at final page
- Auto Submit ON submits test fixture and verifies confirmation

## Phase 16 - File upload engine

Port/adapt proven DataTransfer/File patterns.

Deliver:
- standard file input
- hidden input
- custom upload wrapper
- upload state observer
- previously uploaded document selector architecture
- upload verification

Acceptance:
- representative fixtures accept PDF/DOCX
- filename/success state verified

## Phase 17 - Resume parser and canonical representation

Deliver:
- PDF text import
- DOCX text import
- structured resume parser
- applicant-profile mapping suggestions
- editable canonical resume representation

Acceptance:
- sample resume can be imported and represented structurally
- parser never silently deletes unsupported sections

## Phase 18 - Resume tailoring

Deliver:
- AI resume tailor service
- truthfulness checks
- relevance scoring/selection
- structured output
- deterministic PDF/DOCX renderer
- document provenance

Acceptance:
- target job produces tailored artifact
- facts remain traceable to source profile/resume
- generated resume remains text-selectable/ATS-readable

## Phase 19 - Cover-letter generation

Deliver:
- job-specific AI generator
- settings/style
- PDF/DOCX renderer
- document association

Acceptance:
- generated letter cites real applicant material
- no unsupported claim in test cases

## Phase 20 - Document strategy

Deliver:
- auto-select existing resume
- auto-tailor resume
- auto-generate cover letter when configured
- application document association
- upload integration

Acceptance:
- application request for resume chooses/generates correct document then uploads

## Phase 21 - ATS adapters

Start with:
1. Workday
2. Greenhouse
3. Lever
4. Ashby

Then:
5. Oracle
6. SAP SuccessFactors
7. iCIMS
8. Taleo
9. Microsoft-specific recruiting flows
10. IBM-specific recruiting flows if distinct from underlying ATS

For each adapter:
- inspect real accessible DOM
- document evidence
- capture fixtures where legally/technically practical
- implement adapter-specific scanner/executor/navigation overrides
- retain generic fallback

Do not claim support without passing adapter tests.

## Phase 22 - Boundaries and CAPTCHA

Deliver:
- CAPTCHA detection/wait
- assessment classification
- video interview boundary
- identity verification boundary
- e-sign/legal boundary
- safe resume after CAPTCHA clears

Acceptance:
- no CAPTCHA solving code
- test fixture pauses/resumes correctly

## Phase 23 - Cross-browser hardening

Test:
- Zen/Firefox
- Firefox standard
- Chromium/Chrome

Pay special attention to:
- MAIN-world injection
- service worker lifecycle
- file handling
- permissions
- message ports
- SPA navigation
- localhost connectivity

## Phase 24 - Observability and debug bundle

Deliver:
- structured logs
- field/action journal
- adapter name
- page snapshots
- validation history
- sanitized AI metadata
- exportable debug JSON

## Phase 25 - Release readiness

Deliver:
- setup wizard
- backend launcher/dev docs
- production builds
- README
- privacy/security documentation
- license/NOTICE
- donor attributions
- versioning
- migration scripts
- backup/export

Do not call the project complete until `TESTING_AND_ACCEPTANCE.md` is satisfied.
