---
name: data-model
description: Use when modifying Mongoose schemas, defaults, indexes, startup migrations, old-document compatibility, or MongoDB persistence behavior.
---

# Data Model Skill

## Read First

- `aiTeam/docs/domain-model.md`
- `aiTeam/docs/project-invariants.md`
- `aiTeam/docs/risk-levels.md`
- `backend/models/index.js`
- `backend/server.js`
- route files that read/write the model
- frontend callers that depend on the fields

## Workflow

1. Identify the collection, schema field, default, and callers.
2. Check whether old documents may lack the field or contain old values.
3. Decide whether a startup migration is required.
4. Preserve `null`, `0`, empty string, and missing-field semantics.
5. Update backend route behavior and frontend assumptions together when needed.
6. Verify old-document compatibility and new-document defaults.

## Rules

- Schema changes are high risk by default.
- Do not silently drop or rewrite user data.
- Do not change indexes without considering existing data.
- Keep migrations explicit and easy to see in startup logs.
- Document durable schema rules in `domain-model.md` or `project-invariants.md`.

## Verification

- Check affected model writes and reads.
- Start backend with MongoDB when runtime verification is needed.
- Verify frontend route behavior if displayed data shape changes.

