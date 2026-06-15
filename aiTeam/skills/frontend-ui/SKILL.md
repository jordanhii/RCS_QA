---
name: frontend-ui
description: Use when modifying Vue views, Element Plus UI, router behavior, Pinia state, composables, or frontend logic used by the UI.
---

# Frontend UI Skill

## Read First

- `frontend/src/router.js`
- relevant file under `frontend/src/views/`
- `frontend/src/stores/appStore.js` if QA config or RC environments are involved
- `frontend/src/composables/useSyncManager.js` if sync state is involved
- relevant logic file under `frontend/src/logic/`

## Workflow

1. Locate route/view ownership.
2. Check whether behavior is view-local, store-level, composable-level, or logic-helper-level.
3. Keep reusable calculation behavior in `frontend/src/logic/` when practical.
4. Preserve shared sync behavior in `useSyncManager.js`.
5. Keep UI text and state consistent with existing Chinese UI.
6. Add or update focused Vitest coverage for pure logic changes.

## Rules

- Use Vue 3 patterns already present in the repo.
- Use Element Plus conventions already present in views.
- Do not duplicate sync timer/cooldown logic in views.
- Avoid changing API base URL behavior casually; callers use `http://localhost:3000/api`.

## 告警逻辑检查子页面 — 结果列统一约定（务必照此，新页面要和现有页面一致）

新建任何「告警逻辑检查」子页面（TestView / NetflowHistView / PromoYoyView / PromoMomView 等），结果区三列必须按同一套渲染，**别自创样式**（参照 `TestView.vue` 的写法）：

1. **风控系统判断（devResult）= 只读 tag，不是可编辑下拉**
   - `devResult` 来自同步/导入的 RC 判断，是只读展示，**不能用 `<el-select>` 让用户选**。
   - 写法：`<el-tag v-if="row.devResult" :type="row.devResult==='TRUE'?'success':'danger'" size="small">{{ row.devResult }}</el-tag>`；空值显示 `—`。
2. **逻辑一致 = 文字 tag**：`待判断`(info，devResult 为空时) / `✓ 一致`(success) / `✗ 异常`(danger)。
   - 没数据时全显「待判断」是正常的（devResult 还没同步进来），不是 bug。
3. **告警结果列**：表头就叫「告警结果」（**不要带「(RCSQA)」之类后缀**），可配 ⓘ tooltip 说明判断逻辑。
4. 字段为 `null`（接口未抓到）时显示「⚠ 未抓到」。

## Verification

- Run `cd frontend && npm test` for logic changes.
- Run `cd frontend && npm run dev` and manually inspect the affected route for UI changes.

