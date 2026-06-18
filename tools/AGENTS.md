---
audience: [agent]
kind: directive
---

# tools Rules

`tools/` is a thin helper layer for the text harness. It is not the workflow runtime.

- Keep workflow facts in `LOOP.md` and `modules/*`, not in tools.
- Tools may validate structure, sync visual projections, and scaffold node files.
- Do not add model calls, business writing rules, account data, or platform automation here.
- Add or update tests before changing tool behavior.
