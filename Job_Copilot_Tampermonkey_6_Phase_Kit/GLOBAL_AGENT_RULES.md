# Global Coding Agent Rules

1. Work only on the current phase. Do not pre-build later phases except for a tiny abstraction strictly required by current work.
2. Leave the project runnable after every phase. `npm run build` must produce `dist/job-copilot.user.js`.
3. Runtime is only the user's normal browser + Tampermonkey + page DOM + GM APIs + OpenRouter.
4. Do not add a backend, WXT, Selenium, Playwright runtime automation, or external browser controller. Playwright may be used only for deterministic development fixtures/tests.
5. Store core data in GM-managed storage, not page `localStorage` or `sessionStorage`.
6. Store the OpenRouter key only in GM-managed userscript storage. Never expose it to DOM, `window`, logs, debug exports, prompts, or page storage.
7. Use one persistent Shadow DOM control panel.
8. No fake human behavior: no typing animation, random mouse movement, random hesitation, stealth logic, fingerprint spoofing, or CAPTCHA bypass.
9. Field engine rule: `observe -> locate -> scroll -> act -> verify -> repair`.
10. One normal page should use one primary AI request. Individual calls are reserved for Rewrite, repair, or late dynamic fields.
11. Do not invent applicant jobs, projects, dates, tools, certifications, metrics, achievements, or years of experience.
12. Best-effort inference is allowed for unknown structured fields, but mark inferred values internally for review.
13. Pause autonomous progression for assessments, identity verification, recorded/video interviews, e-signatures, and explicit legal attestations.
14. Never solve CAPTCHA. Wait and resume if it clears normally.
15. Use bounded retries. Never create an infinite fill/navigation loop.
16. Preserve license notices for directly reused MIT/BSD code.
17. Commit/tag only after the user manually accepts a phase.
