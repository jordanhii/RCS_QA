# Code Review Prompt

Use the project `aiTeam` reviewer role.

Review this change for:

1. Data loss or migration risk.
2. Duplicate-record or sync idempotency risk.
3. API contract mismatch.
4. Calculation regression.
5. Missing tests.
6. Maintainability issues.
7. Broken project invariants from `aiTeam/docs/project-invariants.md`.
8. Missing high-risk gates from `aiTeam/docs/risk-levels.md`.

Output findings first with file and line references.
If there are no findings, say so clearly and list any residual verification gaps.
