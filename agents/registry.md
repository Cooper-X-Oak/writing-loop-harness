# Agents Registry

- name: topic-gatekeeper
  used_by: 20_topic_gate
  purpose: Protect daily recommendation budget and reject weak/paper-only topics.
  input: Candidate list and duplicate registry.
  output: Selected topic scorecard.
  required: false
  notes: Can be performed by the main agent when no subagent is available.

- name: evidence-analyst
  used_by: 40_evidence_analysis
  purpose: Build neutral public analysis with L1/L2/L3 boundaries.
  input: Source inventory and raw captures.
  output: Public analysis artifact.
  required: false
  notes: Should be adversarial toward unsupported claims.

- name: review-editor
  used_by: 70_review_handoff
  purpose: Verify article package, visual status, blockers, and human review checklist.
  input: Draft, visual plan, gate results.
  output: Review handoff.
  required: false
  notes: Never publishes or performs external writes.
