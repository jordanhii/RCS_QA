# Multi-Agent Bugfix Prompt

Use the project `aiTeam` multi-agent workflow.

Bug:

```text
Describe the observed bug here.
```

Expected:

```text
Describe the expected behavior here.
```

Reproduction:

```text
Affected route/view/API:
Steps to reproduce:
Sample record or payload:
Recent related changes:
Can reproduce locally:
Verification available:
```

Please split the work:

- Explorer A: inspect backend route/model/sync behavior.
- Explorer B: inspect frontend view/state/logic behavior.
- Explorer C: inspect existing tests, risk level, and edge cases.

Lead agent:

1. Identify the root cause.
2. Classify risk using `aiTeam/docs/risk-levels.md`.
3. Implement the smallest safe fix.
4. Add or update focused tests if practical.
5. Run verification.
6. Ask reviewer to check data-loss and regression risks.
7. Report `Not verified` explicitly.
