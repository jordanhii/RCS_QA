# Multi-Agent Feature Prompt

Use the project `aiTeam` multi-agent workflow.

Goal:

```text
Describe the feature here.
```

Context:

```text
Affected route/view/API:
Expected user behavior:
Known data shape or sample:
Must not change:
Verification available:
```

Please split the work:

- Explorer A: inspect backend/API/model impact.
- Explorer B: inspect frontend/UI/state impact.
- Explorer C: inspect tests, risk level, and verification commands.

Lead agent:

1. Integrate findings.
2. Classify risk using `aiTeam/docs/risk-levels.md`.
3. Create a short implementation plan.
4. Assign workers only if write scopes are disjoint.
5. Implement or integrate the change.
6. Run focused verification.
7. Ask reviewer to check regression risk.

Constraints:

- Do not revert unrelated edits.
- Preserve existing data unless migration is explicitly required.
- Keep API contracts backward compatible unless approved.
- Report `Not verified` explicitly.
