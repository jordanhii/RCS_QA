# Hooks

This project does not currently require automation hooks.

Useful future hooks:

- Before commit: run `cd frontend && npm test` when `frontend/src/logic/` changes.
- Before commit: remind contributors to update `aiTeam/docs/repo-map.md` when routes or models change.
- Before release: run frontend tests and manually verify export flows.
- After schema changes: remind contributors to document migration behavior.

Hook rules:

- Hooks should be fast and predictable.
- Avoid hidden writes.
- Avoid long-running worker startup inside hooks.
- Prefer reminders over blocking hooks until the workflow is stable.

