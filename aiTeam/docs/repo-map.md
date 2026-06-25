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

Routes (static routes MUST stay before `/test/:id`):

- `/config/alert`: `ConfigView.vue` — 告警配置（按 typeId 配阈值/倍数）
- `/config/capture`: `CaptureView.vue` — 接口配置（RC 地址 + 字段映射）
- `/config/qa`: `QAConfigView.vue` — 质检配置（同步参数 + 批量开关 + 数据/IGO 导出）
- `/test/game-profit`: `GameProfitView.vue` — 游戏盈利(CG)
- `/test/netflow-hist`: `NetflowHistView.vue` — 存提差同比
- `/test/promo-yoy`: `PromoYoyView.vue` — 优惠同比（typeId 11）
- `/test/promo-mom`: `PromoMomView.vue` — 优惠环比（typeId 12）
- `/test/:id`: `TestView.vue` — 存/提款（天/月）、24h、投/存比 等；存提差环比走 `/test/9`
- 备注：`NetflowCompView.vue` 为存提差环比相关视图组件。

Shared frontend modules:

- `frontend/src/stores/appStore.js`: global QA config and RC environment list.
- `frontend/src/composables/useSyncManager.js`: shared sync/cooldown/timer logic；`filterRecords(allRaw, list)` 按 list 的 RC 地址 + 抓取时间范围过滤。
- `frontend/src/logic/alertLogic.js`: alert calculation logic.
- `frontend/src/logic/gameProfitLogic.js`: game-profit calculation logic.
- `frontend/src/logic/netflowCompLogic.js`: netflow comparison logic.
- `frontend/src/logic/netflowHistLogic.js`: netflow historical comparison logic.
- `frontend/src/logic/promoYoyLogic.js`: 优惠同比逻辑（前7/前30天平均×倍数；普通当日仅一次；连续=隔X分钟+连续倍数）。
- `frontend/src/logic/promoMomLogic.js`: 优惠环比逻辑（本时段增长 vs 上时段增长×倍数；普通×B / 连续×C）。
- `frontend/src/logic/importMapper.js`: import mapping.
- `frontend/src/logic/alertTypes.js`: alert type metadata + `REWARD_TYPE_OPTIONS`（优惠类型下拉项）。
- `frontend/src/components/AlertListShell.vue`: **「告警逻辑检查」列表页共享外壳**（页头/折叠白卡/关联配置行/双时间同步条/统计/批量/分页/导入弹窗 + CRUD/同步/批量等通用逻辑）。优惠同比·环比、游戏盈利、存提差同比 已用它；TestView（typeId 1–9）仍独立但视觉/交互保持一致。改这类页面外观/通用行为 → 改外壳一处全生效。
- `frontend/src/logic/format.js`: 金额千分位 `amtFormat` / `amtParse`（用于 el-input-number 的 :formatter/:parser）。
- `frontend/src/assets/styles/theme.css`: shared CSS variables (design tokens).
- `frontend/DESIGN.md`: **前端设计规范（Design System）。改任何页面 UI 前必读。**（§5 专讲列表页 + AlertListShell 规范。）

Tests:

- `frontend/src/tests/alertLogic.test.js`
- `frontend/src/tests/importMapper.test.js`
- `frontend/src/tests/promoLogic.test.js`（优惠同比/环比，含连续 + 按类型 resolver 用例）

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
