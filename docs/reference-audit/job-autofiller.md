# job-autofiller Audit

## Evidence

- Repository: `https://github.com/lovincyrus/job-autofiller`
- Commit: `c7d7fd6aa61991b369d188418bfd6af9563081e4`
- License: none found in repository or package metadata.
- Stack: Manifest V2-era Chrome extension, jQuery, static JSON applicant data and selector mappings.

Inspected `content.js`, `sites.json`, and `README.md`. `sites.json` separates Greenhouse/Lever/Uber selectors from applicant data. `content.js` loads both files, checks hostname, then assigns values and emits jQuery change. Complex pages are a TODO.

## Test evidence

No tests or package manifest. No upload, custom-control, verification, navigation, or recovery coverage.

## Decision

Use only the unprotectable concept of separating applicant data from site mappings. Copy no source or selector table because no reuse license is granted. Static selector maps are stale and incompatible with generic normalized discovery. Also note `_isSupported` refers to undefined `supportedSites` on the non-exact-host path.

## Attribution

No code reuse permitted without a license grant. This audit is provenance for conceptual research only.
