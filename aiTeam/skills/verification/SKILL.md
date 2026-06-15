---
name: verification
description: Use when deciding how to test or review changes in RCS_QA.
---

# Verification Skill

## Read First

- `aiTeam/docs/common-commands.md`
- relevant package scripts in `frontend/package.json` or `backend/package.json`
- existing tests under `frontend/src/tests/`

## Verification Matrix

- Pure frontend logic: run `cd frontend && npm test`.
- Vue UI: run Vite and inspect the affected route.
- Backend route: run backend with MongoDB and check the endpoint.
- Model/migration: test old and new document behavior.
- Sync: check duplicate prevention and per-URL cache behavior.
- Export: check generated workbook/output shape.

## Verification Rules

- Do not imply verification passed if it was not run.
- If a command fails, report the failure and stop treating the change as verified.
- If verification needs MongoDB, a worker, or browser inspection that is not available, say so.
- UI changes should name the route that was or should be checked.
- Sync/export changes should state whether worker behavior and output shape were checked.
- Schema changes should state whether old-document compatibility was checked.
- Pure logic changes should add or update a focused test when practical.

## Review Checklist

- Is the changed file the owner of the behavior?
- Did API response shape change?
- Did schema defaults or migration behavior change?
- Are `null`, `0`, empty string, and missing field semantics preserved?
- Can repeated sync duplicate records?
- Are tests updated for pure calculation logic?
- Did the change touch unrelated files?

## Final Verification Report

```text
Verification:
Not verified:
Reason:
Residual risk:
```

Use `Not verified: None` only when all relevant checks were completed.
