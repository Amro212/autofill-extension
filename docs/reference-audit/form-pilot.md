# FormPilot Audit

## Evidence

- Repository: `https://github.com/rockbenben/form-pilot`
- Commit: `1b40c228b151894011af81c3a3230bad2a48fc90`
- License: MIT; copyright 2026 rockbenben.
- Stack: WXT, TypeScript, React, Vitest/jsdom.

Inspected:

- `lib/engine/adapters/types.ts`: compact `PlatformAdapter`, `FieldMapping`, fill source/status, and result contracts.
- `lib/engine/adapters/registry.ts`: current registry imports and registers only `mokaAdapter`. README/package keywords do not prove Workday or Greenhouse implementations.
- `lib/engine/scanner.ts`: adapter scan is failure-contained, then unhandled fields use generic heuristics.
- `lib/engine/heuristic/fillers.ts` and `lib/capture/native-set.ts`: prototype setters, event sequence, choice grouping, hidden visual proxies, visible-overlay filtering, exact-before-substring options.
- `lib/capture/signature.ts`, `lib/storage/page-memory-store.ts`, `lib/engine/orchestrator.ts`: label-based signatures, `(signature,index)` URL memory, cross-URL candidates, provenance/status separation.
- `components/toolbar/mount.tsx`: WXT `createShadowRootUi`, inline host, fixed child, pointer-event containment.
- `entrypoints/content.ts`: broad isolated content script, debounced new-field observer, URL polling, bounded pre-mount probes, invalidation cleanup.

## Test evidence

Vitest coverage exists for scanning, orchestration, native fillers, custom selects, storage/memory, capture/restore, visibility, and resume import. Notable assertions cover adapter failure fallback, non-mutating scans, hidden overlay exclusion, exact-over-substring matching, React-compatible setters indirectly, URL memory merging, and status separation. Tests are primarily jsdom; there is no current Workday/Greenhouse browser matrix.

## Port/adapt

- Adapt serializable equivalents of source/status concepts; never retain DOM elements in shared/backend contracts.
- Adapt adapter-failure containment and generic fallback.
- Adapt prototype setters and visible-overlay/exact-first principles with real-state Playwright tests.
- Adapt signature/memory concepts but include normalized question, domain/application scope, provenance, confidence, and employer-safety ranking in backend repositories.
- Use WXT Shadow DOM mounting and lifecycle cleanup patterns.

## Reject/change

- Do not import its resume-path-centric architecture, Chinese job-board heuristics, or Chrome storage model.
- Do not use the registry/README as ATS-support evidence.
- Do not accept immediate read-back as sufficient; add framework reconciliation waits and secondary verification.
- Do not mutate host fields for stable IDs during normalized scanning when a runtime WeakMap/registry can avoid it.

## Attribution

MIT notice required if implementation substantially ports its code. Independent reimplementation of the evidenced patterns will cite this audit.
