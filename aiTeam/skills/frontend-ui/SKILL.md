---
name: frontend-ui
description: Use when modifying Vue views, Element Plus UI, router behavior, Pinia state, composables, or frontend logic used by the UI.
---

# Frontend UI Skill

## Read First

- **`frontend/DESIGN.md` — 设计规范（Design System）。任何页面布局/样式改动前必读，按它来，不要自创布局。**
- `frontend/src/router.js`
- relevant file under `frontend/src/views/`
- `frontend/src/stores/appStore.js` if QA config or RC environments are involved
- `frontend/src/logic/syncCore.js` if sync request/cooldown/time-window behavior is involved（同步核心，改这里而非在视图/外壳里重复）
- `frontend/src/composables/useSyncManager.js` if AlertListShell sync orchestration is involved
- relevant logic file under `frontend/src/logic/`

## 设计规范要点（细节见 `frontend/DESIGN.md`，冲突以 DESIGN.md 为准）

- **页面骨架**：`page-header(title 20px/700 + subtitle 13px)` → `.section-label`（分组标题，在卡片**外**、带主色竖条 `#409EFF`）→ `.config-panel`（白卡 12px 圆角、`#ebeef5` 边、`--qa-shadow-xs`）。几个分组 = 几对 label+card。用 Tab 时，Tab 内部仍按 label+card 分组，不要塞进一张大卡用小标题分段。
- **说明用 hover**：`.section-label` 右侧放淡灰 `QuestionFilled` + `el-tooltip`，不要常驻大说明框。
- **控件不要拉满整行**：固定合适宽度、靠左；表单内容整体限宽（~720–960px），避免被横向撑长。
- **按钮**：主操作 `type="primary"`（实心、默认尺寸，不要 `plain`/`small`）；危险操作 `type="danger" plain`；图标+文字。全站统一。
- **已保存状态** `.save-status`：放卡片**右上角**。
- **编辑态**：配置类页面默认只读，右下角「编辑」→「完成」开关，切换上下文自动退回只读。
- **选择项网格**（如批量开关）：多列小卡片（`#fafbfc` 底、`#ebeef5` 边、10px 圆角、hover/选中高亮），不要无边框挤行。
- 三个配置页（告警/接口/质检）是当前最贴合规范的范本，改新页面先参考它们。
- **告警逻辑检查列表页共用 `src/components/AlertListShell.vue`**（优惠同比/环比、游戏盈利、存提差同比已用；TestView typeId 1–9 仍独立但保持一致）。改这类页面的外观/通用行为 → 改外壳一处全生效；各页只用 props + slots（`#config`/`#columns`/`#filters`）提供差异。详见 DESIGN.md §5。
- 列表页约定：结果列统一 el-tag（连续告警结果也是，不用彩色纯文字，N/A 显示灰「—」）；金额输入框加 `amtFormat/amtParse` 千分位；同步时间用「开始/结束」两栏（结束留空=最新）；表格支持 Shift 框选 + 「只看异常」，不放每行操作列；路由用可读 slug（见 `TEST_SLUG_TO_TYPEID`）。

## Workflow

1. Locate route/view ownership.
2. Check whether behavior is view-local, store-level, composable-level, or logic-helper-level.
3. Keep reusable calculation behavior in `frontend/src/logic/` when practical.
4. 同步的请求/冷却/时间窗行为改 `frontend/src/logic/syncCore.js`（TestView 与 AlertListShell 共用它）。
5. Keep UI text and state consistent with existing Chinese UI.
6. Add or update focused Vitest coverage for pure logic changes.

## Rules

- Use Vue 3 patterns already present in the repo.
- Use Element Plus conventions already present in views.
- 不要在视图里重复同步的请求/冷却/时间窗逻辑——共用 `frontend/src/logic/syncCore.js`。
- Avoid changing API base URL behavior casually; 基址是 `import.meta.env.VITE_API_URL || '/api'`（默认同源）。

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

