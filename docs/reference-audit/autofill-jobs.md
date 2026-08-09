# Autofill-Jobs Audit

## Evidence

- Repository: `https://github.com/andrewmillercode/Autofill-Jobs`
- Commit: `a82a3165856ff461f8fd8f97811695636e11215e`
- License: MIT; copyright 2025 Andrew Miller.
- Stack: Vue configuration UI plus plain content scripts.

Inspected:

- `src/public/contentScripts/autofill.js`: Greenhouse/Lever/Dover mappings and standard file input population.
- `src/public/contentScripts/workday.js`: Workday progress, uploads, skills, repeated work experience, dropdowns.
- `src/public/contentScripts/utils.js`: mappings, events, base64 conversion, storage, native fill helper.

Useful upload pattern: decode stored bytes, construct `File`, add through `DataTransfer`, assign `input.files`, and dispatch `change`. Workday success must still be observed separately; donor only sleeps.

## Test evidence

No automated tests. Build/type-check scripts cover only the Vue app. Content scripts are untyped and untested.

## Confirmed defects

- `if (param === "Gender" || "Location (City)")` is always truthy, so every matching field uses the long delay.
- `setNativeValue` calls `tracker.setValue(previousValue)` with undefined `previousValue`.
- Workday `handleInputElement` references `res` outside its lexical scope for date fields.
- `handleInputElement` returns `false` after a normal successful `setNativeValue`, so callers treat the action as unresolved.
- Several branches dereference missing elements before checking them, and upload success is inferred from event+sleep.

## Port/adapt

- Independently implement bytes -> `File` -> `DataTransfer` -> input event flow.
- Keep historical selectors only as adapter research leads.
- Verify server/page accepted filename or success state before recording upload success.

## Reject/change

- Copy no generic control flow, native setter, timing constants, or Workday state loop.
- Replace fixed sleeps with condition-based bounded waits.
- Keep actual document bytes backend-owned and retrieve them by opaque authenticated document ID.

## Attribution

MIT notice required if any code is substantially ported; current intent is independent implementation.
