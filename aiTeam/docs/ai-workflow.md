# AI Workflow

## Operating Model

RCS_QA should use AI in a structured loop:

```text
work -> learn -> update docs/skills/prompts -> better future work
```

The goal is repeatability, not more ceremony.

## Small Task Flow

1. Read `aiTeam/README.md`.
2. Read `aiTeam/docs/repo-map.md`.
3. Route the task with `aiTeam/docs/task-routing.md`.
4. Classify risk with `aiTeam/docs/risk-levels.md`.
5. Read `aiTeam/docs/project-invariants.md`.
6. Load the relevant skill.
7. Inspect the narrow code path.
8. Make the smallest safe change.
9. Run focused verification.
10. Report files changed, tests run, unverified gaps, and remaining risk.

## Large Task Flow

Use this when work crosses layers or touches risky logic:

1. Lead agent defines goal, scope, constraints, likely files, and verification.
2. Explorer agents inspect independent areas read-only.
3. Lead integrates findings into a plan.
4. Workers implement only disjoint write scopes.
5. Reviewer checks the integrated diff.
6. Lead runs final verification and summarizes.

Before assigning workers, the lead must define file ownership. Two workers must
not edit the same file or tightly coupled files in parallel.

## Handoff Format

Use this format for agent reports:

```text
Scope:
Files inspected:
Files changed:
Findings:
Risks:
Recommended verification:
Open questions:
```

For read-only explorers, omit `Files changed`.

## Final Report Format

```text
Changed:
Why:
Verification:
Not verified:
Risk:
Docs updated:
```

`Not verified` is required. Use `None` only when all relevant checks were run.

## Review Priority

1. Security and permission issues.
2. Data loss or migration risks.
3. Behavior regressions.
4. API contract mismatches.
5. Missing tests.
6. Maintainability risks.

## Documentation Update Rule

Update `aiTeam` docs or skills when a task reveals durable knowledge, such as:

- a command that works or fails in this repo
- a schema rule
- a sync/export edge case
- a route contract
- a UI state pattern
- a testing pattern

Do not update docs for one-off guesses. Update docs only when the code, a test,
or a confirmed user decision proves the knowledge.
