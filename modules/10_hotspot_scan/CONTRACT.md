# 10_hotspot_scan Contract

## Inputs

- Configured public source list or supplied candidate scan.
- Current run state.
- Prior topic registry or duplicate list.

## Outputs

- Candidate list artifact with:
  - title;
  - source URLs;
  - first seen time;
  - freshness window;
  - community signal;
  - conflict/product-impact note;
  - paper-only flag;
  - duplicate-risk flag.

## Artifacts

- `.runs/<run-id>/nodes/10_hotspot_scan/candidates.json`
- `.runs/<run-id>/nodes/10_hotspot_scan/notes.md`

## Dependencies

- Optional search/social collection skill.
- Optional public RSS/source scanner.

No credentials, cookies, or account backend data may be required for this node to pass.
