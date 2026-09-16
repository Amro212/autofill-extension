# Phase 1 — Foundation

## Goal

Prove the basic Tampermonkey product shell before any autofill work.

At the end of this phase:

```text
Tampermonkey runtime
+ modular build
+ persistent Shadow DOM panel
+ GM storage
+ applicant profile
+ settings
+ securely stored API key
+ successful OpenRouter call
+ basic debug logs
```

## Implementation scope

Create:

```text
src/
  main.js
  storage.js
  ui.js
  ai.js
  debug.js
  constants.js
```

Bundle to:

`dist/job-copilot.user.js`

### Tampermonkey metadata

Use the minimum grants required for:
- GM value storage
- privileged cross-origin request
- optional menu reset/debug commands

Allow OpenRouter via `@connect`.

### Panel

Tabs:
- Home
- Profile
- Settings
- Debug

Home:
- Ready / No API Key / API Error
- current URL
- hostname
- Test AI

Profile:
- name
- email
- phone
- location
- LinkedIn
- GitHub
- portfolio
- resume/context text
- applicant notes

Settings:
- OpenRouter API key
- model
- AI Autofill ON
- Auto Continue ON
- Auto Submit OFF
- Autopilot OFF

Debug:
- script version
- URL
- host
- sanitized setting summary
- recent logs
- clear logs

### Storage

Use namespaced helpers, for example:

```text
jc:settings
jc:profile
jc:secrets
jc:debug
jc:version
```

### OpenRouter

Use `GM_xmlhttpRequest`.

Test AI should make a minimal request and show:
- success/failure
- selected model
- latency
- sanitized error

Do not log the key.

## Explicitly NOT in Phase 1

No field scanning, autofill, job capture, ATS adapters, documents, auto-next, or application sessions.

## Codex task

Implement Phase 1 only. Add a `PHASE_1_REPORT.md` with files created, build instructions, manual testing steps, and known limitations. Stop and wait for manual approval.

## Manual acceptance — HARD GATES

### Gate 1: Install
- [x] `dist/job-copilot.user.js` installs in Tampermonkey.
- [x] Reloading a normal site does not break the page.
- [x] Job Copilot panel appears.
- [x] No immediate uncaught console errors.

### Gate 2: UI isolation
- [x] Panel looks correct on at least 3 visually different sites.
- [x] Host CSS does not destroy the panel.
- [x] Panel does not visibly alter the host layout.

### Gate 3: Persistence
Enter test profile/settings data.
- [x] Save and reload.
- [x] Values persist.
- [x] Open another tab/site.
- [x] Values persist there too.
- [x] Toggle settings persist.

### Gate 4: API secret
- [x] Save OpenRouter key.
- [x] Reload page.
- [x] Test AI still works.
- [x] Key is absent from console.
- [x] Key is absent from page DOM.
- [x] Key is absent from debug output.

### Gate 5: AI connectivity
- [x] Test AI succeeds with correct key.
- [x] Wrong key produces a clean visible error.
- [x] Restoring correct key recovers without reinstalling.

### Gate 6: Stability
- [x] Panel collapses/reopens.
- [x] Disabling/re-enabling script does not corrupt settings.

**PASS — Accepted and signed off by user.**
