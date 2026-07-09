# Domain Model

## Core Concepts

- QA config: global sync settings and RC environment list.
- RC environment (`QAConfig.rcEnvs` 每条)：`name` + `rcBaseUrl` + **加密账号**（`username` 明文，`passwordEnc` / `otpSecretEnc` 为 AES-256-GCM 密文）。在「接口配置」页管理；同步/导出经后端解密取用，前端只看得到「是否已设置」。
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

## 优惠告警（typeId 11 同比 / 12 环比）— 算法与配置

数据来自 RC `/rewardAlerts` 的 `alertContent`（`\n` 分隔 8 段），后端 `formatRewardRecord` 按段解析；前端 `promoYoyLogic.js` / `promoMomLogic.js` 计算。

**优惠同比（11，reward-cumulative）：**
- 条件1（起步）：日累计 ≥ 起步判断额 才开始判断。
- 条件2（普通）：日累计 ≥ 前7天平均×倍数 且 ≥ 前30天平均×倍数 → 告警；**同比当日只触发一次**（当天已有更早普通告警则普通判 FALSE，金额够也不行）；过往无数据不触发。
- 条件3（连续）：首次触发后隔 X 分钟再查，恶化到 日累计 ≥ 前7/前30平均×连续倍数 → 再告警。
- ⚠️ 同步解析坑：`avg7`/`avg30` 段存的是「平均×RC倍数」即阈值，要 `rewardRawLast(threshold, mult)`（÷倍数）还原原始平均，否则配置倍数被二次放大（见 `backend/routes/syncCache.js`）。

**优惠环比（12，reward-interval）：**
- 本期增长 = 累计(T) − 累计(T−X分)；上期增长 = 累计(T−X) − 累计(T−2X)。
- 普通：本期 ≥ 上期×B(普通倍数)；连续：本期 ≥ 上期×C(连续倍数，周期内)。
- `上期=0` 合法（前一窗口持平），`0×倍数` 仍可能触发——不是 bug。
- 上期增长**不是**「上一条告警的本期增长」；每分钟独立按窗口算。

**按优惠类型独立配置：**
- `优惠类型`（promoName）支持配多个名称（逗号分隔），下拉项见 `alertTypes.js` 的 `REWARD_TYPE_OPTIONS`，匹配**大小写不敏感**。
- 一个检查列表可关联**多个配置**（`configIds`），每行按其优惠类型自动解析到对应配置。

## 新增/演进字段（近期）

- `Config.mult7Cont` / `Config.mult30Cont`：连续告警的前7/前30天倍数（默认 1.5）。
- `TestList.configIds`（[ObjectId]）：列表可关联多个告警配置（取代单一 `configId`，前端 `fetchLists` 会把旧 `configId` 迁移进 `configIds`）。
- `syncStartTime` + `syncEndTime`：同步「抓取时间范围」（起+止），取代旧的单一起始时间；`TestList` / `GameProfitList` / `QAConfig` 均有。生效口径：全局(质检配置)设了任一时间就整体用全局、否则用列表级（见 `frontend/src/logic/syncCore.js` `syncTimeWindow`，**不逐字段回退**，避免残留列表级时间误挡最新数据）。
- `QAConfig.rcEnvs[].username` / `passwordEnc` / `otpSecretEnc`：RC 环境的加密账号字段（AES-256-GCM，`backend/crypto.js`），取代原先写死在脚本 / `.env` 的账号。

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
