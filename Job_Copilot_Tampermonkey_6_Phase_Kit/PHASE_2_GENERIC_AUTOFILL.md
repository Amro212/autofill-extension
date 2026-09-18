# Phase 2 — Generic AI Autofill

## Goal

Prove the core product on one page:

```text
scan form
-> normalize fields
-> one AI request
-> fill
-> verify
-> show failures
```

## Add modules

```text
src/
  observer.js
  fields/
    scanner.js
    labels.js
    normalize.js
    fillers.js
    verify.js
    highlight.js
```

Study and adapt proven generic ideas from AI Form Filler and FormPilot before reimplementing field primitives.

## Fields

Support:
- text
- textarea
- email
- tel
- URL
- number
- native select
- radio
- checkbox
- contenteditable
- common combobox/listbox/custom select

Extract:
- label
- description/help
- required
- current value
- options
- constraints
- type

## AI

One primary request per page.

Payload:
- applicant profile
- resume/context
- normalized fields
- current values
- options
- constraints

Expected response:

```json
{
  "answers": [
    {"fieldId": "field_x", "value": "..."}
  ]
}
```

Validate response before acting.

## Fill

For each field:

```text
scroll
-> highlight
-> fill through real rendered control
-> dispatch appropriate events
-> read actual resulting state
-> verify
```

Use native prototype setters where needed for framework-controlled inputs.

## UI

Show:
- detected
- filled
- failed
- current progress

Button:
`Autofill This Page`

## Rewrite

Narrative AI-filled fields receive Rewrite:
- click
- optional feedback
- one-field AI call
- replace
- verify

## NOT in Phase 2

No job sessions, multi-page navigation, validation repair loop, documents, or ATS adapters.

## Codex task

Implement only Phase 2. Create deterministic HTML/React fixtures if useful. Produce `PHASE_2_REPORT.md`. Stop for manual approval.

## Manual acceptance — HARD GATES

### Gate 1: Detection
On a form with text, textarea, select, radio, checkbox:
- [x] all logical fields detected
- [x] labels are readable
- [x] required fields identified
- [x] options correct
- [x] no obvious duplicate logical fields

### Gate 2: AI request
- [x] one Autofill action uses one primary page AI request
- [x] AI only returns known field IDs
- [x] select/radio values correspond to real options
- [x] normal length/constraint requirements are respected

### Gate 3: Fill reliability
- [x] text works
- [x] textarea works
- [x] native select works
- [x] radio works
- [x] checkbox works
- [x] React-controlled fixture retains values after rerender
- [x] fields scroll into view during processing

### Gate 4: Verification
Use a field that rejects a naive fill.
- [x] Copilot does not report false success
- [x] failed field is visually marked
- [x] panel failure count is correct

### Gate 5: Existing values
- [x] prefilled field can be overwritten as configured
- [x] replacement value is verified

### Gate 6: Rewrite
- [x] narrative answer fills
- [x] Rewrite appears
- [x] feedback such as "shorter and mention project X" changes only that field
- [x] rewritten value sticks

### Gate 7: Real-page sanity
Test 2 non-critical real forms:
- [x] no page crashes
- [x] no runaway observer loop
- [x] no massive console spam
- [x] panel remains responsive

**PASS — Accepted and signed off by user.**
