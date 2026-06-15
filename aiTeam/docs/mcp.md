# MCP And External Tools

No project-specific MCP server is required by default.

Potential future MCP uses:

- MongoDB inspection for schema/data verification.
- Browser automation for frontend route checks.
- GitHub/issue tracker integration for task context.
- API client integration for repeatable endpoint checks.

Rules:

- Prefer local code and tests before external tools.
- Do not rely on external state for facts that can be proven from the repo.
- Use external tools for verification only when they reduce uncertainty.

