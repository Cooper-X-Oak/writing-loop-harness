---
audience: [agent]
kind: directive
---

# tests Rules

`tests/` verifies the thin helper layer around the text harness.

- Test structural validation, canvas sync, and node scaffolding.
- Do not test caller project content.
- Use temporary directories for generated harness fixtures.
- Do not depend on network, credentials, external model APIs, or user profiles.
- Add a failing test before changing tool behavior.
