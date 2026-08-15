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
- [ ] `dist/job-copilot.user.js` installs in Tampermonkey.
- [ ] Reloading a normal site does not break the page.
- [ ] Job Copilot panel appears.
- [ ] No immediate uncaught console errors.

### Gate 2: UI isolation
- [ ] Panel looks correct on at least 3 visually different sites.
- [ ] Host CSS does not destroy the panel.
- [ ] Panel does not visibly alter the host layout.

### Gate 3: Persistence
Enter test profile/settings data.
- [ ] Save and reload.
- [ ] Values persist.
- [ ] Open another tab/site.
- [ ] Values persist there too.
- [ ] Toggle settings persist.

### Gate 4: API secret
- [ ] Save OpenRouter key.
- [ ] Reload page.
- [ ] Test AI still works.
- [ ] Key is absent from console.
- [ ] Key is absent from page DOM.
- [ ] Key is absent from debug output.

### Gate 5: AI connectivity
- [ ] Test AI succeeds with correct key.
- [ ] Wrong key produces a clean visible error.
- [ ] Restoring correct key recovers without reinstalling.

### Gate 6: Stability
- [ ] Panel collapses/reopens.
- [ ] Disabling/re-enabling script does not corrupt settings.

**PASS only when all 6 gates pass.**
