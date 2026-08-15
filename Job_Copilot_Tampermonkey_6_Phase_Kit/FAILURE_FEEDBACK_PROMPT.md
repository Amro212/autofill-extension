# Failure Feedback Prompt for Codex

```text
The current phase has NOT passed manual acceptance.

Do not begin the next phase.

Failed acceptance item:
[PASTE ITEM]

Expected behavior:
[EXPECTED]

Actual behavior:
[ACTUAL]

Target page / ATS:
[URL OR ATS]

Browser:
[BROWSER]

Console/debug evidence:
[PASTE]

Screenshot notes:
[NOTES]

Your task:
1. Reproduce or reason from the supplied evidence.
2. Identify the root cause.
3. Fix the smallest correct layer.
4. Add a regression test/fixture for this failure where practical.
5. Rebuild dist/job-copilot.user.js.
6. Report exactly what changed.
7. Do not add unrelated features.
8. Wait for me to rerun the same manual checklist.
```
