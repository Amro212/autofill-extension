# Workday adapter

Validated 2026-08-09 against Cisco’s public Workday tenant and an active posting:

- [Cisco Workday careers search](https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers)
- [Representative Software Engineer posting](https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers/job/Galway-Ireland/Software-Engineer---Application-Development_2021167)

## Observed current structure

- Tenant host ends in `myworkdayjobs.com`.
- Search results expose job links under a Search Results region.
- Job pages expose an Apply button.
- Apply opens “Start Your Application” with Autofill with Resume, Apply Manually, and Use My Last Application choices.
- Apply Manually routes to `/apply/applyManually` and showed a five-step progress bar.
- Stable `data-automation-id` values included `applyFlowPage`, `jobTitleHeading`, `progressBar`, `formField-*`, and `bottom-navigation-*` patterns.
- Account creation contained required email/password controls and a `beecatcher` robot-only input.

## Adapter behavior

- Detects host or `data-automation-id="applyFlowPage"`.
- Extracts title, requisition ID, and location from Workday evidence before generic selectors.
- Labels every normalized field `adapterId: "workday"`.
- Ignores password/sign-in controls and `beecatcher`.
- Recognizes Workday bottom-navigation controls while retaining text fallback.
- Requires explicit review evidence before treating a Workday page as final.

## Regression coverage

`apps/extension/src/adapters/adapters.test.ts` exercises the Workday fixture for application detection, text, custom combobox options, dates, repeated company fields, PDF upload, required/site validation, and Continue classification. The shared browser suite verifies SPA multi-step transitions, upload acceptance, repair, bounded navigation retry, review, and submission confirmation.

## Known limitations

- A tenant can insert account creation, SSO, privacy consent, or localization before application fields; credentials are never generated.
- Workday tenant themes can change visible text. Stable automation IDs and generic ARIA/native fallback reduce but cannot eliminate drift.
- Current public inspection stopped at account creation; no account was created and no real application was submitted.
