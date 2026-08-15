# Phase 4 — ATS Hardening

## Goal

Make the generic engine dependable on the mainstream ATS platforms actually used in the job search.

Primary order:
1. Workday
2. Greenhouse
3. Ashby
4. Lever

Secondary after those pass:
5. Oracle
6. SAP SuccessFactors
7. iCIMS
8. Taleo

IBM and Microsoft should be handled according to the actual underlying application flow.

## Architecture

```text
generic engine
      |
platform detector
      |
ATS adapter
      |
normalized fields/actions
      |
generic verification/navigation
```

Adapters improve specific behavior but must not replace generic fallback.

## Adapter responsibilities

Only where needed:
- ATS detection
- field grouping
- repeating employment/education sections
- searchable dropdowns
- custom selects
- custom dates
- navigation
- validation mapping
- upload-control detection for Phase 5

## Reference audit

Study the relevant code from:
- Job App Filler
- FormPilot
- AI Form Filler
- Autofill-Jobs

Focus on:
- current Workday React/custom controls
- Greenhouse variants
- searchable dropdown behavior
- repeated sections
- DOM mutation behavior

Do not trust stale selectors. Inspect current live DOM where accessible.

## Support definition

Do not mark an ATS "supported" merely because one text field worked.

A primary ATS is supported only after the tester passes its hard gate.

## Codex task

Implement primary ATS adapters incrementally:
1. Workday
2. Greenhouse
3. Ashby
4. Lever

Add adapter-specific regression fixtures/tests and documentation of known limitations.

Do not attempt every secondary ATS before primary platforms are solid.

Produce `PHASE_4_REPORT.md` and stop for manual approval.

## Manual acceptance — HARD GATES

### Workday
- [ ] Workday detected correctly
- [ ] text fields fill
- [ ] searchable dropdown fills
- [ ] country/location control fills
- [ ] radio/checkbox questions fill
- [ ] repeated work/education sections are detected if present
- [ ] multi-step navigation works
- [ ] validation errors are detected
- [ ] refresh does not lose session
- [ ] no final submit with Auto Submit OFF

### Greenhouse
- [ ] Greenhouse detected
- [ ] standard fields fill
- [ ] React/custom dropdown variant works when present
- [ ] narrative questions fill
- [ ] required validation works
- [ ] upload control detection does not crash
- [ ] final submit remains manual

### Ashby
- [ ] Ashby detected
- [ ] text fields fill
- [ ] custom/select controls fill
- [ ] dynamic sections rescan
- [ ] validation works
- [ ] navigation works

### Lever
- [ ] Lever detected
- [ ] core fields fill
- [ ] narrative questions fill
- [ ] selects work where present
- [ ] final submit remains manual

### Generic fallback
On a site with no adapter:
- [ ] generic engine still detects/fills
- [ ] adapter system does not suppress fallback

### Stability
Across tested ATS pages:
- [ ] no runaway loops
- [ ] no duplicate fill storm
- [ ] no repeated AI calls on an unchanged page
- [ ] no catastrophic page breakage
- [ ] panel remains usable

**PASS only when all primary ATS, generic fallback, and stability gates pass.**
