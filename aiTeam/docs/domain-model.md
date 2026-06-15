# Domain Model

## Core Concepts

- QA config: global sync settings and RC environment list.
- RC environment: named `rcBaseUrl` target used for sync and QA workflows.
- Alert config: threshold/config records keyed by alert `typeId`.
- Capture config: API endpoint and field path mapping for each alert type.
- Test list: user-managed alert record list for a specific alert type.
- Game profit list: COLORGAME/game-profit records with RTP, bet, GGR, and deviation fields.
- Sync cache: backend-persisted cache of worker-fetched RC data per normalized URL.

## Alert Types

The project uses numeric `typeId` values across configs, routes, views, and logic.
Before changing an alert workflow, inspect:

- `frontend/src/logic/alertTypes.js`
- relevant frontend logic in `frontend/src/logic/`
- `backend/models/index.js`
- `backend/routes/configs.js`
- `backend/routes/testLists.js`
- relevant capture config behavior

Alert calculation work should also load `aiTeam/skills/alert-logic/SKILL.md`.
Schema/default/persistence work should load `aiTeam/skills/data-model/SKILL.md`.

## Record Semantics

- `alertId` is the main identity for deduplication in frontend sync flows.
- `ignored` marks records excluded from user attention or calculation views.
- `devResult` is usually one of `TRUE`, `FALSE`, or empty string.
- Several numeric fields use `null` to mean "missing from API", not zero.
- For netflow historical comparison, some lower-than fields are stored as strings from RC.

## Durable Rules

- Preserve `null` versus `0` semantics.
- Do not change `typeId` meanings casually.
- Treat sync as idempotent: repeated sync should not create duplicate records.
- Treat export formats as external contracts.
- Keep route responses backward compatible unless the caller is updated in the same change.
- Treat changes to these rules as high risk and check `project-invariants.md`.
