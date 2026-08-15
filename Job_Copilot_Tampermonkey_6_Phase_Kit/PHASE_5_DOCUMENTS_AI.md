# Phase 5 — Documents + AI Tailoring

## Goal

Handle application documents end to end with no backend.

Scope:
- persistent document library
- PDF/DOCX resume import
- canonical resume data
- AI resume tailoring
- AI cover-letter generation
- browser-side PDF/DOCX generation
- file upload
- per-application document selection

## Storage

Use GM storage.

For larger binary documents:
- serialize robustly
- chunk large data
- store metadata separately
- reconstruct only when needed

Suggested logical keys:

```text
jc:documents:index
jc:document:<id>:meta
jc:document:<id>:chunk:<n>
```

## Resume import

Support PDF and DOCX.

Use browser-compatible libraries to extract text.

Create an editable canonical resume representation.

Do not directly rewrite existing PDF bytes.

## Resume tailoring

Inputs:
- canonical resume
- applicant profile
- job description
- company/title

AI may:
- reorder supported material
- select relevant bullets
- rewrite supported bullets
- reprioritize skills/projects

AI may not invent unsupported facts, dates, metrics, employers, technologies, credentials, or achievements.

Persist provenance linking generated document to:
- source resume
- application/job
- generation timestamp

## Rendering

Generate ATS-readable PDF and DOCX entirely in-browser.

Keep the initial resume template simple:
- single column
- selectable text
- conventional section order
- no rasterized resume
- no complex graphics

## Cover letters

Generate from real job context and applicant facts.

Persist generated text plus PDF/DOCX artifacts.

## Upload engine

Support:
- `input[type=file]`
- hidden file inputs
- custom wrappers with underlying file input
- `DataTransfer -> File -> input.files`
- upload-state verification

Never mark upload successful just because `change` fired.

## Document policies

Settings:
- use default resume
- auto-select best existing resume
- auto-tailor resume
- generate cover letter when requested
- optional cover-letter generation toggle

## Codex task

Implement Phase 5 in this order:
1. document storage
2. reconstruct/download existing document
3. upload existing document to fixture
4. resume import/canonical representation
5. AI tailoring
6. browser-side PDF/DOCX rendering
7. cover-letter generation
8. ATS upload integration
9. application-document association

Do not build a visual resume designer.

Produce `PHASE_5_REPORT.md` and stop for manual approval.

## Manual acceptance — HARD GATES

### Gate 1: Document library
Upload PDF and DOCX:
- [ ] both appear in library
- [ ] metadata correct
- [ ] survive reload
- [ ] reconstructed/downloaded files open
- [ ] no corruption

### Gate 2: Resume parsing
- [ ] major sections present
- [ ] employment dates correct
- [ ] project names correct
- [ ] skills not silently invented
- [ ] canonical structure is inspectable/editable

### Gate 3: Resume tailoring
Use a real target job:
- [ ] employers unchanged
- [ ] dates unchanged
- [ ] projects are real
- [ ] technologies are supported
- [ ] no fake metrics
- [ ] relevant content emphasized
- [ ] result is materially more targeted

### Gate 4: Generated PDF
- [ ] opens correctly
- [ ] text selectable
- [ ] readable layout
- [ ] no clipped bullets
- [ ] no missing sections
- [ ] ATS-friendly single-column structure

### Gate 5: Generated DOCX
- [ ] opens correctly
- [ ] layout/text intact
- [ ] file is not corrupted

### Gate 6: Cover letter
- [ ] correct company/role
- [ ] real experience used
- [ ] no fabricated claims
- [ ] specific rather than generic
- [ ] PDF/DOCX opens

### Gate 7: Upload fixture
- [ ] stored resume reconstructs as File
- [ ] file input receives correct file
- [ ] correct filename displayed
- [ ] upload state verified

### Gate 8: Real ATS upload
Test on Workday/Greenhouse plus one other primary ATS:
- [ ] correct document selected
- [ ] filename visible
- [ ] site accepts upload
- [ ] next step does not report missing required resume

### Gate 9: Application association
- [ ] history records resume used
- [ ] generated docs link to correct application
- [ ] unrelated application does not inherit wrong tailored file

**PASS only when all gates pass.**
