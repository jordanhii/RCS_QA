# RCS_QA AI Team

This folder is the AI collaboration entry point for the RCS_QA project.
It turns large-codebase work into a repeatable workflow: read the map, load the
right skill, make a scoped change, verify it, and update durable knowledge when
the project teaches us something new.

## Start Here

For any AI-assisted task:

1. Read this file.
2. Read `docs/repo-map.md`.
3. Route the task with `docs/task-routing.md`.
4. Check risk level with `docs/risk-levels.md`.
5. Read `docs/project-invariants.md`.
6. Read the task-specific skill under `skills/`.
7. Inspect only the code path needed for the task.
8. Make the smallest safe change.
9. Run focused verification from `docs/common-commands.md`.
10. Summarize changed files, verification, unverified gaps, and remaining risk.

## Folder Guide

- `docs/`: stable project knowledge, commands, domain notes, workflow rules.
- `skills/`: short SOPs for recurring task types.
- `agents/`: role definitions for lead, explorer, workers, and reviewer.
- `prompts/`: copy-pasteable prompts for feature, bugfix, review, and refactor work.
- `hooks/`: automation notes and future hook ideas.

Key docs:

- `docs/task-routing.md`: decide which docs, skills, agents, and checks apply.
- `docs/risk-levels.md`: decide whether a task can proceed directly or needs a gate.
- `docs/context-policy.md`: keep AI context focused and prevent broad accidental edits.
- `docs/project-invariants.md`: project rules that should not be broken casually.

## Default Workflow

Use a single-agent workflow for small and medium tasks:

1. Confirm the goal and affected area.
2. Route the task and classify risk.
3. Load one or two relevant skills.
4. Read the narrow code path.
5. Implement.
6. Run focused tests or a build.
7. Report result with unverified gaps.

Use a multi-agent workflow for larger or riskier tasks:

- backend and frontend both change
- database schema or migrations change
- sync, export, financial, alert, or data-loss logic changes
- refactors touch shared modules
- a reviewer pass is needed

Important rule: do not assign two workers to edit the same files in parallel.

## Final Report Template

Use this when finishing AI-assisted work:

```text
Changed:
Why:
Verification:
Not verified:
Risk:
Docs updated:
```

## RCS_QA Project Snapshot

RCS_QA is a QA alert/configuration tool with:

- Express + Mongoose backend in `backend/`
- Vue 3 + Vite + Element Plus frontend in `frontend/`
- Python workers for RC sync and Excel/IGO export at repo root
- MongoDB database `qa_alert_system`
- frontend tests with Vitest

The highest-risk areas are sync idempotency, alert calculation logic, export
format compatibility, MongoDB schema changes, and UI state shared between test
views.
