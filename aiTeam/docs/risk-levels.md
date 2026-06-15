# Risk Levels

Use this file to decide how much process a task needs before editing.

## L1 Low Risk

Examples:

- documentation-only changes
- small UI copy changes
- isolated style tweaks
- adding a narrow prompt or note

Allowed flow:

- single agent
- direct edit after reading relevant file
- lightweight verification

Required final report:

- changed files
- verification or reason none was needed

## L2 Medium Risk

Examples:

- one Vue view change
- one backend route change without schema changes
- pure frontend logic with tests
- command/doc updates that affect developer workflow

Allowed flow:

- single agent is usually enough
- read owner file and call sites
- run focused verification

Required gate:

- identify affected callers before editing shared code
- report tests/checks run

## L3 High Risk

Examples:

- MongoDB schema/default/migration changes
- sync cache, worker, or deduplication changes
- export file shape changes
- alert calculation changes without strong test coverage
- backend and frontend contract changes together
- broad refactors of shared modules

Required flow:

1. Lead defines scope, constraints, and verification.
2. Explorer inspects the risky path read-only when ownership is unclear.
3. Implementation plan is stated before editing.
4. Reviewer checks the final diff or plan.
5. Final verification is run or explicitly marked unavailable.

Required final report:

- changed behavior
- data compatibility impact
- verification
- not verified
- residual risk

## Stop Conditions

Stop and ask the user before proceeding when:

- the task requires deleting or rewriting user data
- API compatibility must be broken
- expected behavior conflicts with current domain rules
- production credentials or private external systems are required
- verification would require a destructive action

