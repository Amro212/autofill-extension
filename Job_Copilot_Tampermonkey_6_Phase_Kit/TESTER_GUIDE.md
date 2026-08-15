# Manual Tester Guide

You are the acceptance tester.

## Primary environment

- Zen / Firefox-based browser
- Tampermonkey
- your normal logged-in browsing profile

Secondary cross-browser testing happens in Phase 6 with Chromium + Tampermonkey.

## Before every test

- [ ] Build latest userscript.
- [ ] Update it in Tampermonkey.
- [ ] Reload target page.
- [ ] Open DevTools Console.
- [ ] Confirm no immediate uncaught exception.
- [ ] Open Job Copilot panel.
- [ ] Confirm current phase/version is visible.

## On failure, capture

- URL
- ATS/site
- browser
- screenshot
- console error
- Job Copilot debug output
- exact field/action
- expected behavior
- actual behavior

## Rule

A phase does not pass because the code looks good or automated tests pass.

A phase passes only when **every HARD GATE** in its manual checklist passes in your real browser.
