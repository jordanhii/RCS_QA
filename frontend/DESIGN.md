# RCS QA 前端设计规范（Design System）

> 目的：让每个页面长一个样。新建/改造任何页面前先读本文件，按这里的「骨架 + 组件 + 规则」来做，不要凭感觉自创布局。
> 技术栈：Vue 3 + Element Plus 2.3 + 自定义 CSS 变量（见 `src/assets/styles/theme.css`）。**仅 Light Mode，不做 Dark Mode。**

---

## 1. 设计令牌（Design Tokens）

颜色、圆角、阴影、过渡统一走 `theme.css` 的 CSS 变量，**不要在组件里写死十六进制**（除下表已固定的语义色）。

### 主色 / 强调
| 用途 | 值 |
| --- | --- |
| 主色（强调、主按钮、标题竖条） | `#409EFF` |
| 主色-浅（提示框底） | `#f2f8ff` |
| 主色-浅边框 | `#e1ebf7` |

### 语义色（来自 theme.css）
| 用途 | 变量 / 值 |
| --- | --- |
| 通过 / 一致 | `var(--qa-pass)` `#52c41a`；浅底 `#d9f5d6` |
| 失败 / 不一致 | `var(--qa-fail)` `#ff4d4f`；浅底 `#fbbfbc` |
| 警示（时间范围提示等） | `#E6A23C` |

### 中性色
| 用途 | 值 |
| --- | --- |
| 标题文字 | `var(--qa-heading-color)` `#1d2129` |
| 正文/标签文字 | `#4e5969` |
| 次要文字/说明 | `#909399` |
| 卡片边框 | `#ebeef5` |
| 分隔线（卡内） | `#f5f6f8` |
| 卡片内浅底（环境项/批量卡） | `#fafbfc` |

### 圆角 / 阴影 / 过渡
| 用途 | 值 |
| --- | --- |
| 卡片圆角 | `12px` |
| 小元件圆角（提示框/工具条/批量卡） | `10px` |
| 卡片阴影 | `var(--qa-shadow-xs)` |
| 过渡 | `var(--qa-transition)` |

---

## 2. 页面骨架（所有页面必须一致）

```
.page-header
  h2.page-title          ← 20px / 700
  p.page-subtitle        ← 13px / #909399
[可选 el-tabs]
  .section-label  ← 分组标题，在卡片【外】，带主色竖条
  .config-panel   ← 白卡片
     [内容]
  .section-label
  .config-panel
     [内容]
```

**核心规则：分组标题 `.section-label` 永远在卡片外、卡片上方。** 一个页面有几个分组，就有几对「label + card」。参考 `接口配置`（RC 系统地址 / 字段映射配置两对）。

### 2.1 用了 Tab 的页面
Tab 只替代「页面顶层分区导航」，**不替代卡片分组**。进入某个 Tab 后，内部仍然用 `.section-label + .config-panel` 一对对地组织，跟没有 Tab 的页面完全一样。

> ❌ 不要：把一个 Tab 的所有内容塞进一张大卡片，再在卡片里用小标题分段。
> ✅ 要：一个 Tab 内有几个子分组，就放几对「label + card」。

---

## 3. 组件规范

### 3.1 分组标题 `.section-label`
- 14px / 700 / `--qa-heading-color`
- 左侧 `::before` 主色竖条：`width:3px; height:14px; radius:2px; background:#409EFF`
- 在卡片外、卡片上方，`margin-bottom:12px`

### 3.2 卡片 `.config-panel`
```css
background:#fff; border:1px solid #ebeef5; border-radius:12px;
padding:20px 22px; box-shadow:var(--qa-shadow-xs);
```

### 3.3 说明 / 提示：用「鼠标移入」，不要常驻
- **不要**在页面上常驻一整块说明框占地方。
- 在 `.section-label` 文字右侧放一个淡灰 `?` 图标（`QuestionFilled`），`el-tooltip` 悬停显示说明。
```html
<div class="section-label">
  分组名
  <el-tooltip placement="top" effect="dark" :show-after="100">
    <template #content><div style="max-width:320px;line-height:1.7;">说明…</div></template>
    <el-icon class="section-help"><QuestionFilled /></el-icon>
  </el-tooltip>
</div>
```
```css
.section-help{ font-size:14px; color:#c0c4cc; cursor:help; transition:color .15s; }
.section-help:hover{ color:#409EFF; }
```
- 单个字段的小提示，同样用 13px 灰 `InfoFilled` + tooltip，跟在字段 label 后面。

### 3.4 表单字段
两种排法，按场景择一，**同一张卡内只用一种**：

**A. 标签居左（label 左、控件右）** — 字段少、偏「设置项」时用。
```css
.param-row{ display:flex; align-items:center; gap:20px; padding:12px 0; border-bottom:1px solid #f5f6f8; }
.param-row:last-child{ border-bottom:none; }
.param-row-label{ width:100~120px; flex-shrink:0; font-size:13px; font-weight:500; color:#4e5969; }
```

**B. 标签在上（label 上、控件下）** — 横向排几个字段、偏「工具栏」时用。
```css
.field-row{ display:flex; flex-wrap:wrap; gap:18px 24px; align-items:flex-end; }
.field{ display:flex; flex-direction:column; gap:7px; }
.field-label{ font-size:13px; font-weight:500; color:#4e5969; }
```

> ⚠️ **卡片满宽，但栏位限宽。** `.config-panel` 一律满宽（右边缘和其它页对齐，别给卡片加 max-width）；把 `.params-list` 限 `max-width: 720px`，让 label+控件靠左、分隔线短、不铺满整卡（参考告警配置）。控件用「内容合适的固定宽度」（下拉 150–160px、时间范围 ~380px、长输入 420px 上限），不要拉满整行。

### 3.5 按钮
- 主操作（新增配置 / 添加 / 编辑 / 完成 / 导出）：`type="primary"`（**实心蓝，不要 `plain`**），默认尺寸（不写 `size="small"`）。
- 次要操作（恢复默认 / 关闭全部）：默认 `el-button`（白底）或 `plain`。
- 危险操作（删除）：`type="danger" plain`。
- 图标 + 文字：`<el-icon style="margin-right:4px;"><X /></el-icon> 文字`。
- 同一排功能按钮，尺寸、风格保持一致。

### 3.6 自动保存状态 `.save-status`
- 样式：`display:inline-flex; align-items:center; gap:5px; font-size:13px; color:#909399;`
- 文案：`✓ 已保存 HH:MM:SS` / `保存中…` / `保存失败 [重试]`
- 位置：**卡片右上角**（与卡片首个内容行同一水平线，靠右）。

### 3.7 编辑态（只读 → 点编辑才可改）
- 默认只读：输入控件 `:disabled="!editMode"`，隐藏「删除」「添加」等编辑按钮。
- 右下角 `编辑`（primary 实心）→ 点开后变 `完成`（primary 实心），并显示编辑类按钮。
- 切换上下文（如换类型）自动退回只读态。
- 参考 `接口配置 / 字段映射配置`。

### 3.8 卡片底部操作行 `.panel-footer`
```css
.panel-footer{ display:flex; justify-content:space-between/flex-end; align-items:center; gap:8px;
  padding-top:14px; margin-top:4px; border-top:1px solid #f5f6f8; }
```
左放编辑类按钮、右放主操作（或编辑/完成开关）。

### 3.9 Tabs
```css
.qa-tabs :deep(.el-tabs__item){ font-size:14px; font-weight:600; height:42px; }
.qa-tab-label{ display:inline-flex; align-items:center; gap:6px; }  /* 图标+文字 */
```

### 3.10 多选项（如批量开关）
- 用**等宽网格**（`grid-template-columns: repeat(3, minmax(0,1fr)); gap:10px`，窄屏降到 2 列），每格一张小卡：`#fafbfc` 底、`1px #ebeef5` 边、`10px` 圆角、hover 高亮、选中 `#ecf5ff`+主色边。
- 格内 `checkbox + 标签 + 状态tag` **靠左成组**（`display:flex; align-items:center; gap:8px`，**不要 `justify-content:space-between`**）——左对齐成组，列与列对齐，整齐。
- ❌ 不要把状态推到最右（label 左、tag 右，中间一大段空白）。
- ❌ 不要内容自适应宽度的 chip 自由换行（宽窄不一会更乱）。
- ❌ 不要无边框挤在一起的小行。

---

## 4. 间距
- 页面外层留白由布局容器负责；卡片内边距 `20px 22px`。
- 分组（label+card）之间纵向间距 `20~24px`。
- 卡片内分隔用 `1px #f5f6f8` 细线或 `el-divider`。

---

## 5. 告警逻辑检查列表页（共享外壳 `AlertListShell`）

所有「告警逻辑检查」子页面（存提款各类、投/存比、优惠同比/环比、游戏盈利、存提差同比/环比）**共用一个外壳组件** `src/components/AlertListShell.vue`。改这类页面的「外观/通用行为」请改外壳（一处改、全部生效）；各页只通过 **props + slots** 提供差异。

- **现状**：优惠同比/环比、游戏盈利、存提差同比 **已用外壳**；存提款那批（TestView，typeId 1–9）目前是**独立组件**但视觉/交互与外壳保持一致（改其一务必同步改另一处，直到 TestView 也并入外壳）。
- **外壳 props**：`typeId / pageTitle / pageSubtitle / listsApi / cacheTypeId / configsTypeId / importAlertType / multiConfig / typeColor / newRecord / getMatchCount / getRowClass / mapSyncRecord / mapImportRow / getCfgForList / getCfgForRow / extraFilter / 以及 loadListsRequest·saveRequest·createRequest·deleteRequest·getCacheUrl·recordPreprocess·listDefaults` 等覆盖钩子。
- **外壳 slots**：`#config`（配置选择器 + 页面特有开关）、`#columns`（表格列，scoped: list/getCfg/getCfgForRow）、`#filters`（操作栏右侧的额外筛选，如优惠类型）。

### 6.1 列表卡片骨架（每个 list = 一张独立白卡，`el-collapse`）
- **卡头 `.list-head`**：`⬤类型色点 + 列表名(14px/700) + ✎编辑 + 「N 条异常」红 tag + spacer + 已保存`。
- ⚠️ **折叠头右侧留间距**：`.list-head` / `.collapse-header` 加 `padding-right:16px`，否则「已保存 / 删除」会贴住折叠箭头。
- **卡身**：`关联配置行（左=配置选择器，右=导入/手工新增/删除）` → `同步条` → `统计条` → `操作条` → `表格` → `分页`。
- 列表名字号 **14px**（与配置页列表标题一致）。

### 6.2 关联配置行的操作按钮
- 右侧三个按钮统一 `size="small"` + `plain`：导入 Excel（`type=primary plain`）、手工新增（`plain`）、删除（`type=danger plain`），各带图标。
- el-upload 包裹的「导入」要 `height:24px; display:inline-flex; align-items:center`，并 `:deep(.el-button + .el-button){margin-left:0}`，否则会高低/间距不齐。

### 6.3 同步抓取时间 = 两个独立栏位
- **不要用 datetimerange 单栏**。用「开始时间」「结束时间」两个 `type="datetime"` 栏位，中间一个「至」。
- **结束留空 = 一直抓到最新**（过滤 `eMs = end ? … : Infinity`）。质检配置的全局同步时间同理。

### 6.4 结果列 / 判定列：统一用 `el-tag` 胶囊
- 普通告警结果 / 连续告警结果 / 风控系统判断 / 逻辑一致 **一律 el-tag**（`TRUE`=success 绿、`FALSE`=danger 红、`待判断`/`—`=info）。
- ❌ 连续告警结果不要用彩色粗体纯文字；不适用值显示灰色「—」（`color:var(--qa-neutral)`），不要做成 tag。
- 风控系统判断（devResult）是**只读 tag**，不可编辑下拉。

### 6.5 金额显示千分位
- 金额类 `el-input-number` 一律加 `:formatter="amtFormat" :parser="amtParse"`（来自 `src/logic/format.js`）：显示 `111,111`、存纯数字、不丢小数。
- 仅金额/计数列用；RTP%、比值、倍数等小数/百分比字段**不要**加。

### 6.6 表格批量操作（不要每行操作列）
- **不放每行的「忽略/删除」操作列**（省空间）。统一靠勾选 + 操作栏的「忽略/恢复/删除」+「批量操作 ▾（全部）」。
- **Shift 框选**：勾一行后按住 Shift 勾另一行 → 中间整段一次选中（`@select` + `toggleRowSelection` + 全局 shift 监听）。不显示多余提示文字。
- **「只看异常」**：操作栏放一键过滤按钮，点一下只剩 `✗ 异常` 行；上方「N 条异常」红 tag 也可点击触发。

### 6.7 路由用可读 slug
- 子页面路由用英文 slug（`/test/netflow-comp`、`/test/deposit-daily`…），**不要数字 `/test/9`**。slug→typeId 映射见 `alertTypes.js` 的 `TEST_SLUG_TO_TYPEID`；旧数字路由保留兼容。

---

## 6. Do / Don't 速查
- ✅ 分组标题在卡外、带主色竖条；❌ 标题塞卡内当小字。
- ✅ 说明用 hover tooltip；❌ 常驻大说明框。
- ✅ 控件固定合适宽度、靠左、整体限宽；❌ 控件拉满整行、页面被强行撑长。
- ✅ 主按钮实心蓝默认尺寸、全站统一；❌ 一个 plain 一个实心、一个 small 一个 default。
- ✅ 已保存在卡片右上；❌ 塞在底部角落。
- ✅ 只读默认、点编辑才改（配置类页面）。
