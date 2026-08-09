# Source Reuse Audit

The agent must study these repositories before implementing equivalent browser-side primitives.

Do not blindly copy entire projects. Extract proven Lego pieces and adapt them to this architecture.

Preserve all license notices required by reused code.

## 1. FormPilot

Repository:
`https://github.com/rockbenben/form-pilot`

License: MIT

Best donor areas:
- `PlatformAdapter` interface idea
- normalized field/fill-result types
- framework-safe native setters
- fill-source/status model
- cross-URL answer memory concepts
- Shadow DOM UI isolation
- SPA-aware rescanning
- profile/domain preference concepts
- draft / answer-memory concepts

Important audit finding:
The README describes broad ATS coverage, but the current adapter registry inspected during research registered only Moka. Do not assume its advertised adapters are actually available in the current branch. Verify every reusable module.

Directly inspect:
- `lib/engine/adapters/types.ts`
- `lib/engine/adapters/registry.ts`
- `lib/engine/heuristic/fillers.ts`
- `lib/capture/native-set.ts`
- memory/signature/storage modules
- Shadow DOM toolbar implementation

Use the design, tests, and stable primitives.
Do not transplant its entire extension architecture.

## 2. AI Form Filler

Repository:
`https://github.com/haonguyenstech/ai-form-filler`

License: MIT

This is the strongest generic field-engine donor.

Directly inspect:
- `page-funcs.js`
- `background.js`
- `inject.js`
- Playwright fixtures/tests

High-value behavior:
- arbitrary-page field scanning
- label extraction:
  - label[for]
  - wrapping label
  - aria-label
  - aria-labelledby
  - ancestor form item
  - sibling text
  - placeholder/name/id fallback
- required-field detection
- field metadata serialization
- async combobox option harvesting
- Radix/shadcn custom-select handling
- date-picker handling
- scroll-before-interaction
- framework-safe native value setter
- input/change/blur event sequence
- state snapshot / undo
- exact-before-fuzzy option matching
- one-page -> one-AI-request -> structured JSON -> fill pipeline
- single-field regeneration concept
- actual verification after fill

Do NOT keep:
- direct provider keys in extension
- Chrome-only orchestration
- fake test-data prompt
- its generic product UX

Move AI/provider calls into our backend.

## 3. Job App Filler

Repository:
`https://github.com/berellevy/job_app_filler`

License: BSD-3-Clause

This is the strongest ATS-specific donor.

Directly inspect:
- `src/inject/app/services/formFields/baseFormInput.tsx`
- Workday folder
- Greenhouse folder
- Greenhouse React folder
- searchable dropdown classes
- multi-select classes
- file classes
- date classes
- repeating section logic
- injected/content communication architecture

High-value behavior:
- MutationObserver-driven field registration
- field classes by control/site type
- Workday-specific React behavior
- Greenhouse variants
- repeated work/education sections
- file controls
- searchable custom controls
- field-level path/section awareness

Do NOT adopt:
- React app attached to every field as the primary product UI
- its complete answer-storage path design
- its entire legacy architecture

Port only proven ATS behavior into our adapter/executor contracts.

## 4. Autofill-Jobs

Repository:
`https://github.com/andrewmillercode/Autofill-Jobs`

License: MIT

Use mostly as a file-upload and legacy ATS reference.

High-value pattern:
- convert stored bytes/base64 to browser `File`
- populate a file input through `DataTransfer`
- dispatch `change`
- verify resulting attachment state

Also inspect:
- Workday behavior
- Greenhouse/Lever selectors
- resume storage concepts

Important audit finding:
The source contains at least one obvious logic bug in its generic flow. Treat the repository as reference material, not trusted production code.

## 5. job-autofiller

Repository:
`https://github.com/lovincyrus/job-autofiller`

Use only as a simple conceptual reference for:
- separating user data from site mappings
- simple Greenhouse/Lever mapping

Do not use as a production foundation.

## 6. Simplify public engineering material

Repository:
`https://github.com/SimplifyJobs/extension-take-home`

This is architectural validation, not a code donor.

Study its task model:
- locate
- act
- wait
- verify
- execute sequential actions
- represent automation as structured actions where useful

Do not add fake typing/mouse behavior as an objective.

## 7. Reuse policy for the agent

Before writing a generic primitive already solved above:

1. inspect donor implementation
2. inspect donor tests
3. understand browser assumptions
4. confirm current WebExtension compatibility
5. port/adapt only what fits our contracts
6. add attribution when code is reused
7. write regression tests in our project

Never depend on a donor repository at runtime.
