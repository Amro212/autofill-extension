# AI Form Filler Audit

## Evidence

- Repository: `https://github.com/haonguyenstech/ai-form-filler`
- Commit: `e5e066b3f50287c59a653e253bf47be2a6eddd3f`
- License: MIT; copyright 2026 Hao Nguyen.
- Stack: Manifest V3 JavaScript extension plus Playwright scripts.

Inspected:

- `page-funcs.js`: native and custom-field discovery, label cascade, visibility, requirements, option harvesting, fill, date picker, snapshots, undo.
- `background.js`: extract -> one AI call -> fill pipeline, preview, apply, single-field regeneration, direct provider access.
- `inject.js`: in-page review UI, settings, rewrite affordance, and extension messaging.
- `test/test-page.html`, `run-mainworld.mjs`, `run-async.mjs`, `run-undo.mjs`, `run-review.mjs`: React/Radix-like field fixture and observed-state browser checks.

Label evidence order is explicit `label[for]`, wrapping label, `aria-label`, `aria-labelledby`, nearest owner label/legend, preceding sibling, then placeholder/name/id. Async list harvesting waits for first option, polls until count stabilizes twice, closes, and retries once. Filling scrolls first, uses prototype setters for text, dispatches input/change/blur, snapshots prior state, and uses exact/substring/word overlap option scoring.

## Test evidence

The test package runs nine Playwright scripts in Chromium. Tests inspect post-fill values, visible selected text, date display, async option count/content, undo, review UI, names, inline rewrite UI, instructions, and provider connectivity behavior. They are executable scenario scripts rather than isolated unit tests. Firefox, uploads, repeated sections, validation repair, and reconciliation after a later React rerender are absent.

## Port/adapt

- Primary evidence for generic label extraction and field serialization.
- Adapt async option stabilization, but scope options to the active visible listbox and use mutation/settling budgets rather than global options.
- Adapt scroll/open/wait/exact-match/click/verify for custom controls.
- Adapt snapshot/undo journal semantics, including explicit non-revertible results.
- Preserve one primary AI call per page and single-field rewrite/repair exceptions.
- Rebuild its fixtures in TypeScript and run under Chromium plus Firefox.

## Reject/change

- Provider keys and calls in extension background violate required trust boundaries; all provider work moves backend-side.
- Broad `chrome.scripting.executeScript({world: "MAIN"})` extraction exposes too much logic/data. Job Copilot scans in isolated world and bridges narrow actions only.
- It excludes file inputs and lacks upload verification.
- `fillCombobox` falls back to first option when no match; reject. Ambiguity must fail safely or request repair.
- Success counters often trust the action return without a durable second read. Add reconciliation verification and typed failure evidence.
- Test-data prompt is irrelevant and unsafe for truthful applicant use.

## Attribution

MIT notice required for substantial code ports. Generic behavior will preferably be independently implemented from tests and documented evidence.
