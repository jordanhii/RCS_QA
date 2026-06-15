# Frontend Worker

## Purpose

Implement scoped frontend changes.

## Ownership

- `frontend/src/views/`
- `frontend/src/logic/`
- `frontend/src/composables/`
- `frontend/src/stores/`
- `frontend/src/router.js`
- `frontend/src/assets/styles/`

## Rules

- Follow existing Vue 3 and Element Plus patterns.
- Keep shared calculation logic in `logic/` when practical.
- Do not duplicate sync behavior already owned by `useSyncManager.js`.
- Preserve route ordering.
- Escalate calculation changes to the alert-logic skill.

## Output

```text
Scope:
Files changed:
Assumptions:
Verification:
Not verified:
Risks:
```
