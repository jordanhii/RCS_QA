# Common Commands

Run commands from the repository root unless noted.

## Backend

Install dependencies:

```bash
cd backend
npm install
```

Start backend:

```bash
cd backend
npm run dev
```

Production-style start:

```bash
cd backend
npm start
```

Backend expects MongoDB at:

```text
mongodb://127.0.0.1:27017/qa_alert_system
```

Known gap: the backend package currently has no test script. Backend changes are
usually verified by starting MongoDB, running the backend, and checking the
affected endpoint or frontend flow.

生产环境（`NODE_ENV=production`）下 `npm start` 会**强校验**安全密钥
（`APP_SECRET_KEY`/`JWT_SECRET`/`WORKER_TOKEN`），缺失或仍是默认值会拒绝启动。

清空同步数据（保留列表和配置）：

```bash
node backend/reset_db.js          # 交互确认；--force 跳过确认
```

会清空 testlists/gameprofitlists 的 records + synccaches，并 `POST /api/sync-cache/flush`
通知运行中的后端清内存缓存（否则内存旧数据会回流）。

## Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Start Vite dev server:

```bash
cd frontend
npm run dev
```

Run frontend tests:

```bash
cd frontend
npm test
```

Build check (verify a view/template change compiles — fast, no dev server needed):

```bash
cd frontend
npx vite build
```

Vite usually serves the frontend on port `5173` unless that port is occupied.
For UI-only/template/style changes, `npx vite build` passing is the quick gate;
still run `npm run dev` + manual inspect when layout/interaction changes.

## 生产构建 / 部署

后端在生产会同域托管 `frontend/dist`，所以要先构建前端：

```bash
cd frontend && npm run build     # 产出 frontend/dist，后端 express.static 托管
```

部署（Render + MongoDB Atlas，导出/同步留本地 Mac）详见根目录 **`DEPLOY.md`**；
`Dockerfile` / `render.yaml` 已备好，一个服务即含前端+后端。

## Python Workers

Inspect worker scripts before changing sync/export behavior:

```bash
python3 rc_sync_service.py
python3 export_worker.py
```

Only start long-running workers when needed for manual verification.

Known gap: worker runtime arguments and environment needs should be confirmed
from the worker source before running them. Do not assume every worker can be
validated by a no-argument command.

## Focused Verification Guide

- Frontend logic change: run `cd frontend && npm test`.
- Vue UI change: run `cd frontend && npm run dev`, then manually check the affected route.
- Backend route change: start MongoDB and `cd backend && npm run dev`, then call the affected endpoint.
- Schema change: verify old documents, startup migration behavior, and frontend consumers.
- Sync/export change: verify worker script behavior and backend route integration.

## Verification Reporting

Every final report should include:

- command or manual check run
- result
- checks not run
- reason checks were not run
- residual risk
