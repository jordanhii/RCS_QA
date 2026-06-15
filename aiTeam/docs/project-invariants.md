# Project Invariants

These rules should not be broken casually. If a task requires changing one,
classify it as high risk and explain the reason before editing.

## Data Semantics

- `null` and `0` mean different things. `null` often means the RC API did not
  return a value or a field mapping is missing; `0` is a real numeric value.
- Empty string, missing field, and `null` can have different meanings in stored
  documents and UI state.
- `devResult` is generally `TRUE`, `FALSE`, or empty string.
- `ignored` marks records that should be excluded from user attention or some
  calculation flows.

## Identity And Sync

- `alertId` is the primary identity for many alert records.
- Repeated sync must be idempotent and should not create duplicate records.
- Sync cache behavior must stay isolated by normalized RC URL.
- Worker state JSON files are runtime state, not design source of truth.

## Routing And API

- `backend/server.js` should stay an entry point and route mount file.
- Backend business logic belongs in route/helper modules.
- Frontend API callers currently assume `http://localhost:3000/api`.
- API response shape is a contract with frontend views and worker flows.
- Static Vue routes such as `/test/game-profit` and `/test/netflow-hist` must
  remain before `/test/:id`.

## Persistence

- MongoDB schema changes must account for old documents.
- Startup migrations should be explicit and visible.
- List records can grow large; respect `MAX_RECORDS` and document size risk.

## Calculation And Export

- Alert calculation changes are business logic changes, not cosmetic refactors.
- Export file shape is an external user-facing contract.
- For export changes, route success is not enough; output shape matters.

