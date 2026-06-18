# Skills Registry

- name: search-social-collection
  used_by: 10_hotspot_scan, 30_source_collect
  purpose: Discover and collect public web/community sources for AI/tech hotspot candidates.
  required: false
  notes: Must not require account cookies to pass the basic loop.

- name: fact-checking-or-deep-research
  used_by: 40_evidence_analysis
  purpose: Verify claims, label L1/L2/L3, and preserve source boundaries.
  required: false
  notes: L3 claims cannot enter article facts.

- name: writer-adapter
  used_by: 50_draft_package
  purpose: Produce first full draft from public analysis and source material.
  required: false
  notes: If configured but unavailable, pause instead of silently falling back.

- name: copy-editing
  used_by: 50_draft_package
  purpose: Sentence-level cleanup, structure smoothing, and fact-boundary tightening.
  required: false
  notes: Must not add new facts.

- name: image-generation
  used_by: 60_visual_plan
  purpose: Generate cover/inline visuals when provider is configured.
  required: false
  notes: Visual planning can pass with placeholders when image generation is unavailable.
