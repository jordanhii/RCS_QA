# Task Routing

Use this file after `README.md` and `repo-map.md` to decide what to read, which
skill to load, and how much process the task needs.

## Routing Table

| Task type | Read docs | Load skills | Agent pattern | Verification |
| --- | --- | --- | --- | --- |
| Repo orientation | `repo-map.md`, `context-policy.md` | `repo-map` | Single agent | None, unless files change |
| Vue UI/view change | `repo-map.md`, `project-invariants.md` | `frontend-ui`, `verification` | Single agent unless cross-layer | Vite route check; tests for logic |
| Frontend calculation logic | `domain-model.md`, `project-invariants.md` | `alert-logic`, `verification` | Single agent + reviewer for risky formulas | `cd frontend && npm test` |
| Backend route/API | `repo-map.md`, `project-invariants.md` | `backend-api`, `verification` | Single agent for one route; reviewer if contract changes | endpoint/manual flow |
| Mongo schema/defaults | `domain-model.md`, `risk-levels.md`, `project-invariants.md` | `data-model`, `backend-api`, `verification` | Lead + explorer/reviewer | migration/old-document check |
| Sync/cache/deduplication | `domain-model.md`, `risk-levels.md`, `project-invariants.md` | `sync-export`, `verification` | Lead + explorer + reviewer | duplicate/cache/worker check |
| Export/IGO export | `domain-model.md`, `project-invariants.md` | `sync-export`, `backend-api`, `verification` | Lead + reviewer | generated output shape |
| Refactor | `context-policy.md`, `risk-levels.md` | relevant owner skill, `verification` | Plan first; workers only for disjoint files | before/after behavior check |
| Code review | `risk-levels.md`, `project-invariants.md` | `verification` | Reviewer | findings first |
| Documentation only | relevant docs | `repo-map` if structure changed | Single agent | link/path check |

## Escalation Triggers

Escalate from single-agent direct work to lead/reviewer flow when:

- the change crosses backend and frontend
- data persistence or migration changes
- sync, export, dedupe, or worker behavior changes
- alert calculation behavior changes without existing tests
- shared composables, stores, or models are modified
- the task requires interpreting production-like data

## Before Editing

The lead agent should be able to state:

```text
Goal:
Risk level:
Files likely touched:
Files explicitly off-limits:
Skill(s) loaded:
Verification target:
```

