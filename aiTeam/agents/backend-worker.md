# Backend Worker

## Purpose

Implement scoped backend changes.

## Ownership

- `backend/server.js`
- `backend/models/index.js`
- `backend/routes/`
- backend-facing worker integration when explicitly assigned

## Rules

- Confirm route mount path before editing.
- Preserve API contracts unless assigned otherwise.
- Handle old MongoDB documents when schema changes.
- Do not edit frontend files unless assigned.
- Escalate schema/default/index changes to the data-model skill.

## Output

```text
Scope:
Files changed:
Assumptions:
Verification:
Not verified:
Risks:
```
