# AI Team Design 架构说明

## 1. 设计目标

AI Team Design 是一套面向软件开发的 AI 协作架构。

它的目标不是让 AI 代替开发者，而是把 AI 从“一个会写代码的助手”升级成“一套可重复、可审计、可扩展的协作系统”。

当代码库变大以后，单个 AI 助手直接处理所有事情会带来明显风险：

- 上下文读取过多，反而混乱
- 忽略已有架构和局部约束
- 重复实现已有逻辑
- 修改错误层级
- 多文件改动缺少边界
- 没有明确验证闭环
- 每次任务都依赖临时 prompt，难以复用经验

AI Team Design 要解决的是这些问题：

- 让 AI 知道从哪里开始
- 让 AI 知道该读什么、不该读什么
- 让 AI 按任务类型加载不同能力
- 让复杂任务可以被拆分给不同角色
- 让高风险改动有门禁
- 让验证成为流程的一部分
- 让项目经验可以沉淀回文档、skills 和 prompts

核心原则：

```text
不是让 AI 一次性理解整个项目，
而是让 AI 每次都能稳定进入正确上下文。
```

## 2. 核心架构

推荐的 AI Team 目录结构：

```text
aiTeam/
  README.md
  aiTeamDesign_CN.md
  docs/
    repo-map.md
    domain-model.md
    common-commands.md
    ai-workflow.md
    task-routing.md
    risk-levels.md
    context-policy.md
    project-invariants.md
    mcp.md
    hooks.md
  skills/
    repo-map/
      SKILL.md
    backend-api/
      SKILL.md
    frontend-ui/
      SKILL.md
    data-model/
      SKILL.md
    verification/
      SKILL.md
  agents/
    lead.md
    explorer.md
    backend-worker.md
    frontend-worker.md
    test-worker.md
    reviewer.md
  prompts/
    multi-agent-feature.md
    multi-agent-bugfix.md
    code-review.md
    refactor-plan.md
  hooks/
    README.md
```

项目根目录建议保留薄入口文件：

```text
AGENTS.md
CLAUDE.md
```

这些入口文件不要写成长篇手册，只负责告诉 AI：

- 先读哪个文件
- 核心规则是什么
- 详细工作流在哪里

## 3. 分层职责

### 3.1 Root Entry

根目录入口文件，例如 `AGENTS.md`、`CLAUDE.md`。

作用：

- 给 AI coding agent 一个统一入口
- 写明最重要的全局规则
- 指向真正的 AI Team 工作流目录

不适合放：

- 长篇架构文档
- 复杂业务规则
- 过期讨论记录
- 大量 prompt 模板

推荐内容：

```text
Read aiTeam/README.md first.
Then read aiTeam/docs/repo-map.md.
For task-specific work, load the relevant skill under aiTeam/skills.
```

### 3.2 README

`aiTeam/README.md` 是 AI Team 的主入口。

它应该回答：

- 这个 AI Team 是什么
- AI 和开发者应该从哪里开始
- 每个子目录负责什么
- 小任务怎么做
- 大任务怎么做
- 最终交付应该怎么报告

README 不应该承担所有细节。
它更像导航页，而不是百科全书。

### 3.3 Docs

`docs/` 是项目级稳定知识库。

它记录“长期成立的事实”，例如：

- 项目结构
- 业务概念
- 数据模型
- 开发命令
- 风险规则
- 验证方式
- AI 工作流
- 外部工具接入

典型文档：

- `repo-map.md`：代码地图、入口文件、关键模块
- `domain-model.md`：领域概念、数据含义、业务规则
- `common-commands.md`：开发、测试、构建、部署命令
- `ai-workflow.md`：AI 在项目中如何工作
- `task-routing.md`：不同任务应该加载哪些 docs、skills、agents
- `risk-levels.md`：低、中、高风险任务的处理门禁
- `context-policy.md`：上下文读取策略
- `project-invariants.md`：不可随意破坏的项目不变量
- `mcp.md`：外部工具和 MCP 集成说明
- `hooks.md`：自动化检查和 hook 规则

docs 回答的问题是：

```text
这个项目有哪些稳定事实？
```

### 3.4 Skills

`skills/` 是任务型操作指南。

一个 skill 是某类任务的 SOP。
它应该足够小，让 AI 只在需要时加载，而不是每次读完整手册。

常见 skill：

- `backend-api`
- `frontend-ui`
- `data-model`
- `database`
- `auth`
- `sync-export`
- `alert-logic`
- `verification`
- `deployment`

一个好的 `SKILL.md` 应该包含：

- 什么时候使用这个 skill
- 修改前先读哪些文件
- 工作步骤
- 不能随便改什么
- 验证要求

推荐结构：

```markdown
---
name: backend-api
description: Use when modifying backend routes, middleware, services, validation, or API contracts.
---

# Backend API

## Read First

- server entry
- relevant route
- model/schema
- frontend caller

## Workflow

1. Confirm route mount path.
2. Inspect validation and data model.
3. Preserve API response shape unless approved.
4. Run focused verification.

## Rules

- Do not break existing callers.
- Do not hide migration failures.

## Verification

- Run focused backend/API checks.
```

### 3.5 Agents

`agents/` 定义 AI 团队里的角色。

角色不是为了形式感，而是为了明确责任边界。

常见角色：

- `lead`：任务负责人，负责拆解、统筹、整合和最终验证
- `explorer`：只读探索者，负责查代码路径和风险
- `backend-worker`：后端实现者
- `frontend-worker`：前端实现者
- `data-worker`：数据模型或迁移实现者
- `test-worker`：测试和验证负责人
- `reviewer`：审查者，负责找问题和风险

关键原则：

```text
不要让所有 agent 都做所有事。
每个 agent 都应该有清晰边界。
```

角色文件应该定义：

- purpose
- ownership
- rules
- output format

### 3.6 Prompts

`prompts/` 存放可复用任务模板。

它们的目标是让开发者更稳定地向 AI 提需求。

常见 prompt：

- `multi-agent-feature.md`
- `multi-agent-bugfix.md`
- `code-review.md`
- `refactor-plan.md`
- `release-check.md`

好的 prompt 应该：

- 可以直接复制使用
- 明确输入字段
- 明确期望输出
- 明确约束
- 明确验证要求

### 3.7 Hooks

`hooks/` 记录自动化规则或未来计划。

常见 hook：

- 修改核心逻辑后提醒运行测试
- 修改 API schema 后提醒更新文档
- commit 前运行 lint 或 unit test
- release 前运行 build 和 smoke test

hook 应该谨慎引入。
坏的 hook 会让团队觉得流程神秘、缓慢、难以控制。

原则：

- 快
- 明确
- 可解释
- 不做隐藏写入
- 不随意阻塞开发者

## 4. AI 工作流模型

AI Team 的工作流可以概括为：

```text
入口 -> 路由 -> 风险分级 -> 上下文读取 -> 实现 -> 验证 -> 复盘沉淀
```

### 4.1 单 Agent 流程

适合：

- 小 bug
- 文档更新
- 单文件 UI 调整
- 单个纯函数修改
- 明确低风险任务

流程：

1. 读 `README.md`
2. 读 `repo-map.md`
3. 通过 `task-routing.md` 判断任务类型
4. 通过 `risk-levels.md` 判断风险等级
5. 加载相关 skill
6. 读取窄范围代码路径
7. 修改
8. 验证
9. 总结结果

### 4.2 多 Agent 流程

适合：

- 跨前后端改动
- 数据模型变更
- 权限、安全、支付、财务、导出、同步等高风险逻辑
- 大范围重构
- 难以定位根因的 bug

流程：

1. Lead 定义目标、范围、约束、风险等级和验证目标
2. Explorer 只读调查独立问题
3. Lead 汇总发现并制定计划
4. Worker 只处理明确分配的文件范围
5. Test Worker 负责测试和验证
6. Reviewer 检查风险和回归
7. Lead 整合结果并输出最终报告

重要规则：

```text
不要让两个 worker 同时编辑同一个文件。
不要让两个 worker 同时改强耦合模块。
```

## 5. 任务路由

任务路由用于决定：

- 该读哪些 docs
- 该加载哪些 skills
- 是否需要多 agent
- 是否需要 reviewer
- 应该怎么验证

示例：

| 任务类型 | 需要加载 | 推荐流程 |
| --- | --- | --- |
| 文档更新 | README / repo-map | 单 Agent |
| 后端 API | backend-api / verification | 单 Agent 或 reviewer |
| 前端 UI | frontend-ui / verification | 单 Agent |
| 数据模型 | data-model / backend-api / verification | Lead + Reviewer |
| 核心业务逻辑 | domain skill / verification | Lead + Test Worker |
| 同步或导出 | sync-export / verification | Lead + Explorer + Reviewer |
| 重构 | context-policy / risk-levels | 先计划，后实现 |

任务路由的价值是：

```text
让 AI 在动手前知道自己处在哪类任务里。
```

## 6. 风险分级

风险分级决定 AI 是否可以直接改代码。

### L1 低风险

例子：

- 文档说明
- 注释修正
- 小样式修改
- 无行为变化的轻量整理

流程：

- 单 Agent
- 可直接修改
- 简单验证

### L2 中风险

例子：

- 单个 API route
- 单个 UI view
- 有测试覆盖的业务函数
- 小范围配置调整

流程：

- 单 Agent 为主
- 需要读取调用方
- 需要 focused verification

### L3 高风险

例子：

- 数据库 schema
- migration
- 权限或安全
- 支付或财务
- 同步、导出、去重
- 跨前后端 API contract
- 大范围重构

流程：

- Lead 先计划
- Explorer 先调查
- Worker 明确边界
- Reviewer 必须检查
- 必须报告未验证项

## 7. 上下文策略

AI 不应该每次都读取整个项目。

推荐策略：

1. 先读入口
2. 再读代码地图
3. 根据任务路由加载 skill
4. 只读拥有该行为的文件
5. 修改共享模块前搜索调用方
6. 遇到不确定再扩大上下文

上下文读取原则：

- 先窄后宽
- 先 owner 后 caller
- 先事实后推测
- 先验证已有模式，再新增模式

禁止行为：

- 因为一个 bug 顺手重构整个模块
- 没有搜索调用方就改共享函数
- 把运行时状态文件当成设计事实
- 读到一半就大范围修改
- 没有验证就说“应该没问题”

## 8. 项目不变量

每个项目都应该维护一份 `project-invariants.md`。

它记录“不能随便破坏”的规则，例如：

- 某些字段的 `null` 和 `0` 含义不同
- 某些 ID 是去重或关联的核心
- API response shape 是外部 contract
- 某些路由顺序不能改变
- 某些文件只做入口，不放业务逻辑
- 导出格式必须兼容旧版本
- migration 必须兼容旧数据

不变量的作用是：

```text
把项目里最容易被 AI 无意破坏的知识显式化。
```

## 9. 验证策略

AI Team 的核心要求之一是：修改必须有验证闭环。

验证可以是：

- unit test
- integration test
- lint
- type check
- build
- API check
- UI manual check
- generated output check
- migration compatibility check

最终报告必须包含：

```text
Verification:
Not verified:
Reason:
Residual risk:
```

如果没有运行测试，必须明确说明。

不要写：

```text
应该可以。
```

应该写：

```text
未运行测试，因为当前项目没有 backend test script。
剩余风险是 API runtime 行为需要在本地服务启动后确认。
```

## 10. Review 策略

Reviewer 的职责不是鼓励，也不是总结。
Reviewer 的职责是找问题。

Review 优先级：

1. 数据丢失
2. 安全和权限
3. migration 风险
4. API contract 破坏
5. 行为回归
6. 测试缺失
7. 可维护性问题

Reviewer 输出应该 findings first。

如果没有发现问题，也要说明剩余风险：

```text
No findings.
Residual risk: export output shape was not manually checked.
```

## 11. 知识沉淀

AI Team 应该持续更新。

当任务中发现稳定知识时，应该更新：

- `repo-map.md`
- `domain-model.md`
- `project-invariants.md`
- 对应 `SKILL.md`
- prompts
- hooks 文档

但不要把一次性猜测写进文档。

只有满足以下条件之一，才适合沉淀：

- 代码证明了它
- 测试证明了它
- 用户明确确认了它
- 多次任务重复遇到它

## 12. 成熟度模型

AI Team 可以按阶段演进。

### Stage 1：入口清晰

- 有 `AGENTS.md`
- 有 `aiTeam/README.md`
- 有基本 repo map

### Stage 2：任务可路由

- 有 skills
- 有 prompts
- 有 task-routing
- 有 common commands

### Stage 3：风险可控

- 有 risk-levels
- 有 project-invariants
- 有 verification rules
- 有 reviewer

### Stage 4：多人协作

- 有 lead / explorer / worker / reviewer
- 有 handoff format
- 有文件 ownership
- 有多 agent 任务模板

### Stage 5：持续改进

- docs/skills/prompts 会随项目演进
- hooks 或 CI 参与验证
- MCP 工具接入真实数据或外部系统
- 团队形成稳定 AI 协作习惯

## 13. 推荐最终交付格式

AI 完成任务后，建议始终使用：

```text
Changed:
Why:
Verification:
Not verified:
Risk:
Docs updated:
```

这个格式可以让开发者快速判断：

- 改了什么
- 为什么改
- 是否验证
- 哪些没验证
- 还有什么风险
- 是否沉淀了新知识

## 14. 总结

AI Team Design 的本质不是“多几个 agent 名字”。

它真正解决的是：

- 入口问题
- 上下文问题
- 分工问题
- 风险问题
- 验证问题
- 知识复用问题

好的 AI Team 工作流应该让 AI 更稳，而不是更复杂。

最终目标：

```text
让每一次 AI 协作都能沿着同一套可靠路径前进，
让项目越大，AI 越不容易失控。
```
