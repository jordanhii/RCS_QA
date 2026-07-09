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
- Frontend API 基址是 `import.meta.env.VITE_API_URL`，默认同源 `/api`（后端同域托管前端；本地开发经 Vite proxy 转发到 3000）。**不要写死成 `http://localhost:3000`**。
- API response shape is a contract with frontend views and worker flows.
- Static Vue routes such as `/test/game-profit` and `/test/netflow-hist` must
  remain before `/test/:id`.

## Persistence

- MongoDB schema changes must account for old documents.
- Startup migrations should be explicit and visible.
- List records can grow large; respect `MAX_RECORDS` and document size risk.

## Security And Credentials

- RC 账号密码/OTP 必须经 `backend/crypto.js`（AES-256-GCM）加密后存 `QAConfig.rcEnvs`，
  **绝不明文入库**。对前端接口只回「是否已设置」（见 qaConfig.js `maskEnv`），**绝不回传密文/明文**；
  解密后的明文只经 `/rc-envs/credentials`（worker 令牌或管理员）给同步/导出用。
- 生产环境（`NODE_ENV=production`）缺少 `APP_SECRET_KEY` / `JWT_SECRET` / `WORKER_TOKEN`，
  或它们仍是默认值 → 后端**拒绝启动**（`server.js` assertProdSecrets）。不要为图方便绕过。
- `APP_SECRET_KEY` 一旦变更，已加密的账号将无法解密——视为高风险变更。

## Calculation And Export

- Alert calculation changes are business logic changes, not cosmetic refactors.
- Export file shape is an external user-facing contract.
- For export changes, route success is not enough; output shape matters.

