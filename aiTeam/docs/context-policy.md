# Context Policy

This policy keeps AI work focused as the codebase grows.

## Read Order

1. `aiTeam/README.md`
2. `aiTeam/docs/repo-map.md`
3. `aiTeam/docs/task-routing.md`
4. `aiTeam/docs/risk-levels.md`
5. `aiTeam/docs/project-invariants.md`
6. Relevant skill files
7. Narrow code path

## Context Budget

Start with the smallest useful context:

- 1 entry file
- 1 owner file
- 1 model/store/composable if involved
- 1 caller or test file
- 1 relevant skill

Expand only when the current file proves another dependency matters.

## Search Rules

- Use `rg` or `rg --files` before broad filesystem scans.
- Search for API paths, model names, function names, and alert type IDs.
- Before editing a shared module, search all call sites.
- When reading large files, read focused ranges first.

## Edit Discipline

- Do not perform opportunistic refactors.
- Do not mix formatting churn with behavior changes.
- Do not edit runtime state files unless the task explicitly requires it.
- Do not change both sides of an API contract without checking callers.
- If unrelated dirty files exist, leave them alone.

## Uncertainty

Record uncertainty when:

- code paths disagree
- comments conflict with implementation
- tests are missing
- a worker or external service is needed but not running
- data shape depends on RC responses not present in the repo

