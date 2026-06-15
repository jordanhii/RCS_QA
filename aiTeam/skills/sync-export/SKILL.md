---
name: sync-export
description: Use when changing RC sync, sync cache, Python worker integration, Excel export, IGO export, or record deduplication behavior.
---

# Sync And Export Skill

## Read First

- `backend/routes/syncCache.js`
- `backend/routes/export.js`
- `frontend/src/composables/useSyncManager.js`
- `rc_sync_service.py`
- `export_worker.py`
- `igo_export_worker.py`
- relevant frontend view that starts sync or export

## Workflow

1. Identify whether the task affects sync request, cache read, frontend dedupe, or export generation.
2. Trace the full path from UI action to backend route to Python worker.
3. Preserve idempotency: repeated sync should not create duplicates.
4. Confirm `alertId` or equivalent identity behavior before changing dedupe.
5. Keep export output compatible with existing user expectations.
6. Verify with a small sample flow where possible.

## Rules

- Treat worker state JSON files as runtime state, not source-of-truth design.
- Do not start long-running services unless needed for verification.
- Be careful with URL normalization and per-RC-environment cache isolation.
- For export changes, verify generated file shape, not only route success.

## Verification

- Backend route check for sync/export endpoints.
- Manual frontend action check when UI initiates the flow.
- Worker-level run only when the changed path needs it.

