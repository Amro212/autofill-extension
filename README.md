# Job Copilot

Job Copilot v1 is a local-first Firefox/Zen and Chromium WebExtension that
observes job applications, captures job context, fills native and custom
fields, generates truthful application documents, repairs validation failures,
and stops at user boundaries. Runtime automation is the extension itself;
Playwright is used only for tests.

## Quick start

Requirements: Node.js 22+, Corepack, and pnpm.

```powershell
corepack enable
pnpm install
pnpm setup
pnpm dev:server
```

The setup command creates `.env` and the gitignored `data/` directory. The
server binds only to `127.0.0.1:4317` and prints a one-time pairing secret.
Keep the default mock provider for deterministic evaluation, or edit `.env` to
select `openrouter` and set `OPENROUTER_API_KEY`.

In a second terminal:

```powershell
pnpm --filter @job-copilot/extension build
pnpm --filter @job-copilot/extension build:firefox
```

Load `apps/extension/.output/chrome-mv3` as an unpacked Chromium extension or
`apps/extension/.output/firefox-mv2` as a temporary Firefox add-on. Open a job
page, enter the pairing secret in the in-page panel, complete Profile, upload a
resume, and choose **Review profile suggestions**. Start autofill explicitly;
Auto Submit is off by default.

## Development and verification

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Use `pnpm backup` while the server is stopped to copy the complete private data
directory into a timestamped `backups/` folder. Restore by replacing `data/`
with a backup while the server is stopped. Schema migrations run automatically
and forward-only at startup.

Architecture and operations are documented in `docs/`. Current ATS evidence is
in `docs/ats/`. This software does not bypass CAPTCHA, assessments, identity
checks, legal attestations, or consent boundaries.

## Version and license

Current release: 1.0.0. MIT licensed; see `LICENSE` and `NOTICE.md`.
