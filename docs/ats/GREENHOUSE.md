# Greenhouse adapter

Validated 2026-08-09 against this public current Greenhouse application:

- [Genius AI — Software Engineer, All Levels](https://job-boards.greenhouse.io/glossgenius/jobs/6681936003)

## Observed current structure

- Host ends in `greenhouse.io`; current hosted boards use `job-boards.greenhouse.io`.
- Job description and application form share one page.
- Standard controls used IDs including `first_name`, `last_name`, `email`, `phone`, `resume`, and `cover_letter`.
- Resume and cover-letter controls were native file inputs with Attach, Dropbox, Google Drive, and Enter manually alternatives.
- Tenant questions used `question_*` IDs.
- Custom selects were text inputs with `role="combobox"` and adjacent Toggle flyout buttons.
- The page exposed required state through ARIA and ended with a Submit application button.

## Adapter behavior

- Detects Greenhouse hosts or application-form/resume evidence.
- Extracts title and numeric job ID from hosted-board evidence.
- Labels every normalized field `adapterId: "greenhouse"`.
- Excludes anonymous internal mirror inputs while retaining native file controls.
- Treats the explicit Greenhouse application form with its submit control as a single final page; generic pages do not inherit this rule.
- Uses shared ARIA combobox, native upload, validation, and verified submit execution.

## Regression coverage

`apps/extension/src/adapters/adapters.test.ts` exercises the Greenhouse fixture for application/final-page detection, text, ARIA custom select selection and verification, date discovery, resume upload discovery, validation evidence, and Submit classification. The shared executor and browser suites cover accepted filename state, repair, and verified confirmation.

## Known limitations

- Tenant-defined questions vary without bound and still rely on page-level AI plus generic field semantics.
- MyGreenhouse, Dropbox, and Google Drive flows are not automated; Job Copilot uses the native file input.
- Bot verification or security-code challenges are user boundaries and are never bypassed.
- Public inspection did not submit a real application.
