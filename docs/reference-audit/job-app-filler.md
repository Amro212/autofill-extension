# Job App Filler Audit

## Evidence

- Repository: `https://github.com/berellevy/job_app_filler`
- Commit: `6d6062cb98bbe70c2946d9d43b519a01b19da448`
- License: `LICENSE.md` contains BSD-3-Clause terms and 2024-present Dovber Levy copyright. `package.json` says ISC; license file governs reuse and mismatch must remain noted.
- Stack: React/TypeScript/webpack extension using injected page-world React internals.

Inspected:

- `baseFormInput.tsx`: field class lifecycle, UUID registration, page/section/type/name path, snapshots, storage calls, field-specific fill abstraction.
- Workday `index.ts`, `xpaths.ts`, `WorkdayBaseInput.ts`, `TextInput.ts`, `DropdownSearchable.ts`, `FileMulti.ts`, dates: `data-automation-id` field wrappers, repeating-section labels, React prop handlers, searchable monikers, popup association, success-element observation, drop callbacks.
- Greenhouse and Greenhouse React indexes/XPaths, searchable and multi dropdowns, files, sections: legacy Select2 and newer React variants, async search, exact option selection, repeated education/employment numbering, drag/drop upload.
- Shared event, file, scroll, XPath, queue, and cross-context helpers.

## Test evidence

No test files or test script exist. Package scripts only watch/build/release. All selector and behavior evidence must be treated as historical until reproduced in Job Copilot fixtures or current public ATS inspection.

## Port/adapt

- Adapt field-class specialization into stateless adapter scanner/executor overrides returning the shared normalized contract.
- Preserve Workday `data-automation-id` signals, popup association concepts, section awareness, and upload success markers as candidate evidence.
- Preserve Greenhouse legacy/new variant separation, Select2 interaction patterns, repeated-section identity, and exact-choice selection concepts.
- Preserve mutation-driven incremental registration while replacing element attributes with a registry/WeakMap when possible.
- Serialize field actions through one queue per application page.

## Reject/change

- Do not attach a React widget to every host field; use one Shadow DOM panel and contextual rewrite controls only.
- Do not read/invoke private React props as the default strategy. Drive rendered controls first; use narrow main-world methods only where current fixtures prove need.
- Do not remove Workday dropdown DOM to close it.
- Do not accept click/event dispatch as verified fill.
- Do not reuse local answer-path/storage architecture.
- Do not claim current ATS support from these selectors without new evidence.

## Attribution

BSD notice and disclaimer required for redistributed source/binary substantial ports. Root `NOTICE.md` must retain the copyright and non-endorsement condition.
