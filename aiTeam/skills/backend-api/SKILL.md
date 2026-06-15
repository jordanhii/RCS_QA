---
name: backend-api
description: Use when modifying Express routes, Mongoose models, startup migrations, API contracts, sync cache routes, or export endpoints.
---

# Backend API Skill

## Read First

- `backend/server.js`
- `backend/models/index.js`
- relevant file under `backend/routes/`
- frontend caller that consumes the route

## Workflow

1. Confirm the route mount path in `backend/server.js`.
2. Inspect the Mongoose model and existing validation/default behavior.
3. Preserve API response shape unless all consumers are updated.
4. Keep business logic inside route/helper modules, not `server.js`.
5. If persistence changes, plan startup migration and old-document compatibility.
6. Verify with focused endpoint checks or by running the consuming frontend flow.

## Rules

- Preserve `null` versus `0` semantics in record fields.
- Avoid unbounded document growth; `MAX_RECORDS` exists for list size risk.
- Treat export and sync endpoints as external contracts for worker/frontend flows.
- Do not hide migration failures.

## Verification

- Start MongoDB if endpoint behavior needs runtime verification.
- Run `cd backend && npm run dev` for manual API checks.
- Run frontend tests when backend changes affect frontend logic expectations.

