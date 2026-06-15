# Repo Map

## Top Level

- `backend/`: Express API server, MongoDB models, route handlers.
- `frontend/`: Vue 3 SPA, routes, views, logic modules, Pinia store, tests.
- `rc_sync_service.py`: long-running RC sync service used by backend sync APIs.
- `fetch_rc_data.py`: RC data fetching helper.
- `export_worker.py`: Excel export worker.
- `igo_export_worker.py`: IGO export worker.
- `ecosystem.config.cjs`: process manager configuration.
- `state*.json`, `*_state.json`: local worker/runtime state files.
- `aiTeam/`: AI workflow docs, skills, roles, and prompts.

## AI Workflow Control Files

- `aiTeam/docs/task-routing.md`: maps task types to docs, skills, agents, and verification.
- `aiTeam/docs/risk-levels.md`: defines L1/L2/L3 gates before editing.
- `aiTeam/docs/context-policy.md`: keeps AI context focused and edits scoped.
- `aiTeam/docs/project-invariants.md`: lists rules that should not be broken casually.
- `aiTeam/skills/data-model/SKILL.md`: schema, defaults, indexes, and migrations.
- `aiTeam/skills/alert-logic/SKILL.md`: alert calculation and type metadata changes.
- `aiTeam/agents/test-worker.md`: focused test and verification ownership.

## Backend

Entry point:

- `backend/server.js`

Routes mounted by `backend/server.js`:

- `/api/configs` -> `backend/routes/configs.js`
- `/api/test-lists` -> `backend/routes/testLists.js`
- `/api/game-profit-lists` -> `backend/routes/gameProfitLists.js`
- `/api/qa-config` -> `backend/routes/qaConfig.js`
- `/api/capture-config` -> `backend/routes/captureConfig.js`
- `/api/* sync` -> `backend/routes/syncCache.js`
- `/api/* export` -> `backend/routes/export.js`

Models:

- `Config`: alert thresholds and type-specific config.
- `TestList`: alert test lists for typeId based workflows.
- `GameProfitList`: game-profit / COLORGAME records.
- `CaptureConfig`: per-alert-type endpoint and field mapping.
- `QAConfig`: singleton global sync settings and RC environments.
- `SyncCacheDoc`: persisted sync cache keyed by normalized RC URL.

Backend notes:

- MongoDB URL is currently `mongodb://127.0.0.1:27017/qa_alert_system`.
- `server.js` runs startup migrations before restoring sync cache.
- Route files own business behavior; keep `server.js` as an entry point.
- API responses are JSON and frontend calls are mostly hard-coded to `http://localhost:3000/api`.

## Frontend

Entry points:

- `frontend/src/main.js`
- `frontend/src/App.vue`
- `frontend/src/router.js`

Routes:

- `/config/alert`: `ConfigView.vue`
- `/config/capture`: `CaptureView.vue`
- `/config/qa`: `QAConfigView.vue`
- `/test/game-profit`: `GameProfitView.vue`
- `/test/netflow-hist`: `NetflowHistView.vue`
- `/test/:id`: `TestView.vue`

Shared frontend modules:

- `frontend/src/stores/appStore.js`: global QA config and RC environment list.
- `frontend/src/composables/useSyncManager.js`: shared sync/cooldown/timer logic.
- `frontend/src/logic/alertLogic.js`: alert calculation logic.
- `frontend/src/logic/gameProfitLogic.js`: game-profit calculation logic.
- `frontend/src/logic/netflowCompLogic.js`: netflow comparison logic.
- `frontend/src/logic/netflowHistLogic.js`: netflow historical comparison logic.
- `frontend/src/logic/importMapper.js`: import mapping.
- `frontend/src/logic/alertTypes.js`: alert type metadata.
- `frontend/src/assets/styles/theme.css`: shared styling.

Tests:

- `frontend/src/tests/alertLogic.test.js`
- `frontend/src/tests/importMapper.test.js`

## Data Flow

Typical alert/config flow:

1. User edits configs in Vue views.
2. Frontend calls Express routes under `/api`.
3. Backend validates and persists through Mongoose models.
4. Test views read lists/configs and run frontend logic helpers.
5. Sync flows request Python worker data through backend sync/cache APIs.
6. Export flows call backend export APIs, which use Python worker scripts.

## Change Risk Map

- `backend/models/index.js`: schema changes can affect persistence and migrations.
- `backend/routes/syncCache.js`, `rc_sync_service.py`: sync behavior and duplicate-record risk.
- `frontend/src/composables/useSyncManager.js`: shared timers and list mutation behavior.
- `frontend/src/logic/*.js`: calculation correctness and test expectations.
- `backend/routes/export.js`, `export_worker.py`, `igo_export_worker.py`: file format compatibility.
- `frontend/src/router.js`: static route ordering matters before `/test/:id`.
- `aiTeam/docs/project-invariants.md`: update when durable non-negotiable rules change.
