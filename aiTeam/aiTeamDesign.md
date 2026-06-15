# AI Team Design

AI Team Design is a reusable architecture for AI-assisted software development.

Its purpose is to make AI collaboration repeatable, reviewable, and safer in
large or growing codebases.

## Core Idea

Do not ask one AI assistant to understand and change an entire codebase at once.
Instead, give AI a structured operating system:

- a clear entry point
- a codebase map
- task-specific skills
- role definitions
- reusable prompts
- risk gates
- context rules
- verification rules
- optional tools and hooks

The workflow is:

```text
entry -> routing -> risk level -> focused context -> implementation -> verification -> learning update
```

## Recommended Structure

```text
aiTeam/
  README.md
  aiTeamDesign.md
  aiTeamDesign_CN.md
  docs/
  skills/
  agents/
  prompts/
  hooks/
```

Root-level files such as `AGENTS.md` or `CLAUDE.md` should stay short and point
to the real workflow under `aiTeam/`.

## Key Principle

The goal is not more process.
The goal is safer AI work with less repeated explanation.

