# Repo Map

## Top Level

- `backend/`: Express API server, MongoDB models, route handlers.
- `frontend/`: Vue 3 SPA, routes, views, logic modules, Pinia store, tests.
- `rc_sync_service.py`: long-running RC sync service used by backend sync APIs.
- `fetch_rc_data.py`: RC data fetching helper.
- `export_worker.py`: Excel export worker.
- `ecosystem.config.cjs`: process manager configuration.
- `state*.json`, `*_state.json`: local worker/runtime state files.
- `Dockerfile`, `render.yaml`, `requirements.txt`: 部署（Render/Docker，后端同域托管前端）+ Python 依赖。
- `DEPLOY.md`: 上线部署说明（Render + MongoDB Atlas，导出/同步留本地 Mac）。
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

- `backend/server.js`（`import './env.js'` 显式加载根目录 .env；生产托管 `frontend/dist`）
- `backend/env.js`: 显式加载仓库根 `.env`，保证从任意目录启动都读到。
- `backend/crypto.js`: AES-256-GCM 加解密（RC 账号密码/OTP 密文存取的唯一入口）。

Routes mounted by `backend/server.js`:

- `/api/health` -> 健康检查（公开；DB 未连时返回 503，部署平台探活用）
- `/api/auth` -> `backend/routes/auth.js`（登录，公开）
- `/api/users` -> `backend/routes/users.js`（仅管理员）
- `/api/configs` -> `backend/routes/configs.js`
- `/api/test-lists` -> `backend/routes/testLists.js`
- `/api/game-profit-lists` -> `backend/routes/gameProfitLists.js`
- `/api/qa-config` -> `backend/routes/qaConfig.js`（含 rc-envs 账号增删改 + `/rc-envs/credentials` 供 worker 取解密凭证；`requireAuthOrWorker`）
- `/api/capture-config` -> `backend/routes/captureConfig.js`
- `/api/sync-*`, `/api/sync-cache/*`（含 `POST /sync-cache/flush` 清缓存） -> `backend/routes/syncCache.js`（`requireAuthOrWorker`）
- `/api/export-data` -> `backend/routes/export.js`（RCS Excel 导出；IGO 导出已移除）

Models:

- `Config`: alert thresholds and type-specific config.
- `TestList`: alert test lists for typeId based workflows.
- `GameProfitList`: game-profit / COLORGAME records.
- `CaptureConfig`: per-alert-type endpoint and field mapping.
- `QAConfig`: singleton 全局同步设置 + RC 环境 `rcEnvs`（每条含 `name`/`rcBaseUrl` + 加密账号 `username`/`passwordEnc`/`otpSecretEnc`）。
- `SyncCacheDoc`: persisted sync cache keyed by normalized RC URL.
- `User`: 登录账号（用户名 / 密码哈希 / 角色 admin|user；首次启动 seedAdmin 预置管理员）。

Backend notes:

- MongoDB URL 来自 `MONGODB_URI`（本地默认 `mongodb://127.0.0.1:27017/qa_alert_system`，线上用 Atlas）。
- `server.js` 启动时：生产环境校验安全密钥（缺 `APP_SECRET_KEY`/`JWT_SECRET`/`WORKER_TOKEN` 直接拒绝启动）→ 连库 → 跑迁移 → 恢复同步缓存 → seedAdmin → 从 .env 加密导入 RC 账号。
- Route files own business behavior; keep `server.js` as an entry point.
- API 响应为 JSON；前端 API 基址为 `import.meta.env.VITE_API_URL`，默认同源 `/api`（后端同域托管前端；本地开发经 Vite proxy 转发到 3000）。

## Frontend

Entry points:

- `frontend/src/main.js`
- `frontend/src/App.vue`
- `frontend/src/router.js`

Routes (static routes MUST stay before `/test/:id`):

- `/config/alert`: `ConfigView.vue` — 告警配置（按 typeId 配阈值/倍数）
- `/config/capture`: `CaptureView.vue` — 接口配置（RC 地址 + 字段映射）
- `/config/qa`: `QAConfigView.vue` — 质检配置（同步参数 + 批量开关 + 数据导出）
- `/test/game-profit`: `GameProfitView.vue` — 游戏盈利(CG)
- `/test/netflow-hist`: `NetflowHistView.vue` — 存提差同比
- `/test/promo-yoy`: `PromoYoyView.vue` — 优惠同比（typeId 11）
- `/test/promo-mom`: `PromoMomView.vue` — 优惠环比（typeId 12）
- `/test/:id`: `TestView.vue` — 存/提款（天/月）、24h、投/存比 等；存提差环比走 `/test/9`
- 备注：`NetflowCompView.vue` 为存提差环比相关视图组件。

Shared frontend modules:

- `frontend/src/stores/appStore.js`: global QA config and RC environment list.
- **`frontend/src/logic/syncCore.js`: 同步核心单一来源**——`requestAndPollCache`（request-sync + 冷却/skipped 处理 + 轮询缓存）与 `filterByTimeWindow`/`syncTimeWindow`（全局优先的时间窗过滤）。TestView、AlertListShell、useSyncManager 三处都调它；改同步行为改这里，别在各处重复。
- `frontend/src/composables/useSyncManager.js`: AlertListShell 用的同步编排（冷却计时器 + 列表增删）；核心流程委托给 `syncCore`，传入的 `filterRecords` 默认就是 `syncCore.filterByTimeWindow`。
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
- `frontend/src/logic/syncCore.js`: 同步核心，改一处影响所有列表页（TestView + AlertListShell + useSyncManager）。
- `backend/crypto.js`, `backend/routes/qaConfig.js`: 账号加解密 / 凭证接口，破坏会导致账号解不开或泄露。
- `frontend/src/composables/useSyncManager.js`: shared timers and list mutation behavior.
- `frontend/src/logic/*.js`: calculation correctness and test expectations.
- `backend/routes/export.js`, `export_worker.py`: file format compatibility.
- `frontend/src/router.js`: static route ordering matters before `/test/:id`.
- `aiTeam/docs/project-invariants.md`: update when durable non-negotiable rules change.
