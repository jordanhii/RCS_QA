---
name: repo-map
description: Use when orienting in RCS_QA, finding affected files, or updating project structure documentation.
---

# Repo Map Skill

## Read First

- `aiTeam/docs/repo-map.md`
- `backend/server.js`
- `frontend/src/router.js`

## Workflow

1. Identify whether the task is backend, frontend, sync/export, data model, or cross-layer.
2. Use `rg` or `find` to locate the narrow code path.
3. Read the route, view, composable, model, or logic helper that owns behavior.
4. Check call sites before editing shared modules.
5. Update `aiTeam/docs/repo-map.md` if structure or ownership changes.

## Rules

- Do not assume `server.js` contains business logic; route files usually do.
- Do not change static route order casually; `/test/game-profit` and `/test/netflow-hist` must precede `/test/:id`.
- Treat Python worker files as part of sync/export behavior.

