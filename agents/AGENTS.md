---
audience: [agent]
kind: directive
---

# agents Rules

`agents/` indexes optional subagent roles used by loop modules.

- Agent roles must have a clear responsibility and handoff contract.
- Do not create subagent roles without a module that uses them.
- If a module depends on a subagent, record it in `agents/registry.md` and the module's `NODE.md`.

