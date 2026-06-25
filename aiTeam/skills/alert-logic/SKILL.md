---
name: alert-logic
description: Use when modifying alert calculations, alert type metadata, game-profit logic, netflow comparison logic, import mapping, or expected QA results.
---

# Alert Logic Skill

## Read First

- `aiTeam/docs/domain-model.md`
- `aiTeam/docs/project-invariants.md`
- `frontend/src/logic/alertTypes.js`
- relevant logic file under `frontend/src/logic/`
- relevant tests under `frontend/src/tests/`
- consuming view under `frontend/src/views/`

## Owned Areas

- `frontend/src/logic/alertLogic.js`
- `frontend/src/logic/gameProfitLogic.js`
- `frontend/src/logic/netflowCompLogic.js`
- `frontend/src/logic/netflowHistLogic.js`
- `frontend/src/logic/promoYoyLogic.js`（优惠同比 typeId 11）
- `frontend/src/logic/promoMomLogic.js`（优惠环比 typeId 12）
- `frontend/src/logic/importMapper.js`
- `frontend/src/logic/alertTypes.js`（含 `REWARD_TYPE_OPTIONS`）
- 同步侧解析：`backend/routes/syncCache.js` 的 `formatRewardRecord`

## 优惠同比/环比专项（改这两类前必看 domain-model.md 对应章节）

- 同比普通告警**当日只触发一次**；后续金额够也只走连续。`上期=0` 在环比里合法。
- 同比同步：`avg7`/`avg30` 段是阈值（平均×RC倍数），必须 `rewardRawLast(threshold, mult)` 还原，否则倍数二次放大。
- 优惠类型多名称、大小写不敏感匹配；列表可关联多个配置（`configIds`），逐行解析。

## Workflow

1. Identify the alert type and expected business rule.
2. Check whether the logic treats `null`, `0`, empty string, and missing fields differently.
3. Inspect existing tests before editing.
4. Make the smallest calculation change.
5. Add or update focused Vitest coverage when practical.
6. Verify consuming view behavior if UI labels or fields change.

## Rules

- Do not treat calculation changes as UI-only changes.
- Do not change type IDs casually.
- Preserve existing result labels unless the task explicitly changes them.
- If tests are missing for a risky rule, report that gap.

## Verification

- Run `cd frontend && npm test`.
- For view-impacting changes, manually inspect the affected route.

