---
name: sync-export
description: Use when changing RC sync, sync cache, Python worker integration, Excel export, or record deduplication behavior.
---

# Sync And Export Skill

## Read First

- `backend/routes/syncCache.js`（含 `POST /sync-cache/flush` 清内存+DB 缓存）
- `backend/routes/export.js`（RCS Excel 导出；`credsForUrl` 解密账号并以环境变量注入 Python）
- `backend/routes/qaConfig.js`（`/rc-envs/credentials`：worker 按 URL 取解密账号）
- `frontend/src/logic/syncCore.js`（**前端同步核心**：request-sync + 冷却 + 轮询 + 时间窗过滤）
- `frontend/src/composables/useSyncManager.js`（AlertListShell 同步编排，委托 syncCore）
- `rc_sync_service.py`
- `export_worker.py`
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
- **账号来源**：RC 账号不写死在脚本里。同步服务经 `GET /api/qa-config/rc-envs/credentials?url=`（带 worker 令牌）向后端取解密凭证；导出由后端 `credsForUrl` 解密后经环境变量注入子进程；两者都以 `.env` 兜底。改凭证流时勿明文落盘、勿回传前端。
- **前端同步核心在 `syncCore.js`**：request-sync 的冷却（`skipped` 时仍读缓存，不早退）、轮询、时间窗过滤都在这一份，TestView / AlertListShell / useSyncManager 共用——改同步行为改这里，别在多处各改一遍。

## Verification

- Backend route check for sync/export endpoints.
- Manual frontend action check when UI initiates the flow.
- Worker-level run only when the changed path needs it.

