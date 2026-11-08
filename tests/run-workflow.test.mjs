import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const runnerUrl = new URL('../tools/run-workflow.mjs', import.meta.url)

function makeHarnessRoot() {
  return mkdtempSync(join(tmpdir(), 'workflow-runner-'))
}

async function writeNode(root, nodeId) {
  await mkdir(join(root, 'modules', nodeId), { recursive: true })
  for (const file of ['AGENTS.md', 'NODE.md', 'SYSTEM.md', 'CONTRACT.md']) {
    writeFileSync(join(root, 'modules', nodeId, file), `${nodeId} ${file}\n`, 'utf8')
  }
  writeFileSync(join(root, 'modules', nodeId, 'GATE.md'), `# Gate

## Outcomes

- pass
- pause
- fail
`, 'utf8')
}

async function writeRunnableHarness(root) {
  await mkdir(join(root, 'skills'), { recursive: true })
  await mkdir(join(root, 'plugins'), { recursive: true })
  await mkdir(join(root, 'agents'), { recursive: true })
  await writeNode(root, '10_hotspot_scan')
  await writeNode(root, '20_topic_gate')

  writeFileSync(join(root, 'AGENTS.md'), '# Root Rules\n', 'utf8')
  writeFileSync(join(root, 'skills', 'registry.md'), '# Skills\n', 'utf8')
  writeFileSync(join(root, 'plugins', 'registry.md'), '# Plugins\n', 'utf8')
  writeFileSync(join(root, 'agents', 'registry.md'), '# Agents\n', 'utf8')
  writeFileSync(join(root, 'LOOP.md'), `# LOOP

## Node Index

| Node | Folder | Purpose | Gate |
|---|---|---|---|
| 10_hotspot_scan | \`modules/10_hotspot_scan/\` | Scan | \`modules/10_hotspot_scan/GATE.md\` |
| 20_topic_gate | \`modules/20_topic_gate/\` | Gate | \`modules/20_topic_gate/GATE.md\` |

## Edge Index

| From | Outcome | To | Meaning |
|---|---|---|---|
| 10_hotspot_scan | pass | 20_topic_gate | Continue |
| 10_hotspot_scan | pause | HUMAN | Ask human |
| 10_hotspot_scan | fail | END | Stop |
| 20_topic_gate | pass | END | Done |
| 20_topic_gate | pause | HUMAN | Ask human |
| 20_topic_gate | fail | END | Stop |

## Current Configuration Status

- active_node: \`modules/10_hotspot_scan/\`
`, 'utf8')
}

async function writeThreeNodeHarness(root) {
  await mkdir(join(root, 'skills'), { recursive: true })
  await mkdir(join(root, 'plugins'), { recursive: true })
  await mkdir(join(root, 'agents'), { recursive: true })
  await writeNode(root, '10_hotspot_scan')
  await writeNode(root, '20_topic_gate')
  await writeNode(root, '30_source_collect')

  writeFileSync(join(root, 'AGENTS.md'), '# Root Rules\n', 'utf8')
  writeFileSync(join(root, 'skills', 'registry.md'), '# Skills\n', 'utf8')
  writeFileSync(join(root, 'plugins', 'registry.md'), '# Plugins\n', 'utf8')
  writeFileSync(join(root, 'agents', 'registry.md'), '# Agents\n', 'utf8')
  writeFileSync(join(root, 'LOOP.md'), `# LOOP

## Node Index

| Node | Folder | Purpose | Gate |
|---|---|---|---|
| 10_hotspot_scan | \`modules/10_hotspot_scan/\` | Scan | \`modules/10_hotspot_scan/GATE.md\` |
| 20_topic_gate | \`modules/20_topic_gate/\` | Gate | \`modules/20_topic_gate/GATE.md\` |
| 30_source_collect | \`modules/30_source_collect/\` | Collect | \`modules/30_source_collect/GATE.md\` |

## Edge Index

| From | Outcome | To | Meaning |
|---|---|---|---|
| 10_hotspot_scan | pass | 20_topic_gate | Continue |
| 10_hotspot_scan | pause | HUMAN | Ask human |
| 10_hotspot_scan | fail | END | Stop |
| 20_topic_gate | pass | 30_source_collect | Continue |
| 20_topic_gate | pause | HUMAN | Ask human |
| 20_topic_gate | fail | END | Stop |
| 30_source_collect | pass | END | Done |
| 30_source_collect | pause | HUMAN | Ask human |
| 30_source_collect | fail | END | Stop |

## Current Configuration Status

- active_node: \`modules/10_hotspot_scan/\`
`, 'utf8')
}

async function writeHotspotSchemas(root) {
  await mkdir(join(root, 'schemas'), { recursive: true })
  writeFileSync(join(root, 'schemas', '10_hotspot_scan.candidates.schema.json'), JSON.stringify({
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      required: ['title', 'sourceUrls', 'firstSeenAt', 'freshnessHours', 'communitySignal', 'conflictOrImpact', 'paperOnly', 'duplicateRisk'],
      properties: {
        title: { type: 'string', minLength: 1 },
        sourceUrls: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        firstSeenAt: { type: 'string', minLength: 1 },
        freshnessHours: { type: 'number' },
        communitySignal: { type: 'string', minLength: 1 },
        conflictOrImpact: { type: 'string', minLength: 1 },
        paperOnly: { type: 'boolean' },
        duplicateRisk: { type: 'boolean' },
      },
    },
  }), 'utf8')
  writeFileSync(join(root, 'schemas', '20_topic_gate.topic-scorecard.schema.json'), JSON.stringify({
    type: 'object',
    required: ['chosenTitle', 'selectionReason', 'interactionPotential', 'duplicateCheck', 'paperSourceDecision', 'dailyBudgetDecision', 'rejectedAlternatives'],
    properties: {
      chosenTitle: { type: 'string', minLength: 1 },
      selectionReason: { type: 'string', minLength: 1 },
      interactionPotential: { type: 'string', minLength: 1 },
      duplicateCheck: { type: 'string', minLength: 1 },
      paperSourceDecision: { type: 'string', minLength: 1 },
      dailyBudgetDecision: { type: 'string', minLength: 1 },
      rejectedAlternatives: { type: 'array', items: { type: 'string', minLength: 1 } },
    },
  }), 'utf8')
  writeFileSync(join(root, 'schemas', '30_source_collect.source-inventory.schema.json'), JSON.stringify({
    type: 'object',
    required: ['topicTitle', 'sources', 'gaps'],
    properties: {
      topicTitle: { type: 'string', minLength: 1 },
      sources: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['title', 'url', 'sourceType', 'capturedAt', 'keyClaim', 'credibility', 'usable'],
          properties: {
            title: { type: 'string', minLength: 1 },
            url: { type: 'string', minLength: 1 },
            sourceType: { type: 'string', minLength: 1 },
            capturedAt: { type: 'string', minLength: 1 },
            keyClaim: { type: 'string', minLength: 1 },
            credibility: { type: 'string', minLength: 1 },
            usable: { type: 'boolean' },
          },
        },
      },
      gaps: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
    },
  }), 'utf8')
}

async function writeCandidateFixture(root) {
  await mkdir(join(root, 'fixtures'), { recursive: true })
  const fixturePath = join(root, 'fixtures', 'candidates.json')
  writeFileSync(fixturePath, JSON.stringify([
    {
      title: 'Community demo hotspot',
      sourceUrls: ['https://example.com/community-demo'],
      firstSeenAt: '2026-06-19T08:00:00+08:00',
      freshnessHours: 3,
      communitySignal: 'Multiple community discussions in the last 6 hours.',
      conflictOrImpact: 'Clear product impact and user-facing disagreement.',
      paperOnly: false,
      duplicateRisk: false,
    },
    {
      title: 'Paper-only background item',
      sourceUrls: ['https://example.com/paper-demo'],
      firstSeenAt: '2026-06-19T07:00:00+08:00',
      freshnessHours: 4,
      communitySignal: 'No visible community traction.',
      conflictOrImpact: 'Method-only update.',
      paperOnly: true,
      duplicateRisk: false,
    },
  ], null, 2), 'utf8')
  return fixturePath
}

async function writeSourceFixture(root) {
  await mkdir(join(root, 'fixtures'), { recursive: true })
  const fixturePath = join(root, 'fixtures', 'source-inventory.json')
  writeFileSync(fixturePath, JSON.stringify({
    topicTitle: 'Community demo hotspot',
    sources: [
      {
        title: 'Official product changelog',
        url: 'https://example.com/product-changelog',
        sourceType: 'original',
        capturedAt: '2026-06-19T09:00:00+08:00',
        keyClaim: 'The product changed its free-tier limits for high-volume users.',
        credibility: 'primary source',
        usable: true,
      },
      {
        title: 'Community discussion thread',
        url: 'https://example.com/community-thread',
        sourceType: 'community',
        capturedAt: '2026-06-19T09:05:00+08:00',
        keyClaim: 'Developers report workflow disruption and debate the pricing change.',
        credibility: 'secondary sentiment source',
        usable: true,
      },
    ],
    gaps: [
      'Need exact rollout date from official source before final draft.',
    ],
  }, null, 2), 'utf8')
  return fixturePath
}

test('startRun creates run state from LOOP active node', async () => {
  const { startRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)

  const manifest = startRun(root, { runId: 'test-run' })

  assert.equal(manifest.currentNode, '10_hotspot_scan')
  assert.equal(manifest.status, 'running')
  assert.ok(existsSync(join(root, '.runs', 'test-run', 'manifest.json')))
  assert.ok(existsSync(join(root, '.runs', 'test-run', 'current-node.md')))
})

test('stepRun dry-run records prompt, gate result, and routes pass outcome', async () => {
  const { startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  startRun(root, { runId: 'route-pass' })

  const result = stepRun(root, { runId: 'route-pass', outcome: 'pass' })

  assert.equal(result.gate.outcome, 'pass')
  assert.equal(result.gate.next, '20_topic_gate')
  assert.equal(result.manifest.currentNode, '20_topic_gate')
  assert.equal(result.manifest.status, 'running')
  assert.ok(existsSync(join(root, '.runs', 'route-pass', 'nodes', '10_hotspot_scan', 'prompt.md')))
  assert.ok(existsSync(join(root, '.runs', 'route-pass', 'nodes', '10_hotspot_scan', 'gate-result.json')))
})

test('stepRun dry-run pauses when outcome routes to HUMAN', async () => {
  const { startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  startRun(root, { runId: 'route-pause' })

  const result = stepRun(root, { runId: 'route-pause', outcome: 'pause' })

  assert.equal(result.gate.next, 'HUMAN')
  assert.equal(result.manifest.currentNode, null)
  assert.equal(result.manifest.status, 'paused')
})

test('extractGateResult reads the final fenced JSON result', async () => {
  const { extractGateResult } = await import(runnerUrl)

  const result = extractGateResult(`notes

\`\`\`json
{"outcome":"pause","reason":"needs source binding","artifacts":["notes.md"]}
\`\`\`
`)

  assert.deepEqual(result, {
    outcome: 'pause',
    reason: 'needs source binding',
    artifacts: ['notes.md'],
  })
})

test('assembleNodePrompt includes root, loop, run manifest, and node harness files', async () => {
  const { startRun, assembleNodePrompt } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  startRun(root, { runId: 'prompt-run' })

  const prompt = assembleNodePrompt(root, 'prompt-run', '10_hotspot_scan')

  assert.match(prompt, /Root AGENTS\.md/)
  assert.match(prompt, /Current Run Manifest/)
  assert.match(prompt, /modules\/10_hotspot_scan\/SYSTEM\.md/)
  assert.match(prompt, /"runId": "prompt-run"/)
})

test('assembleNodePrompt includes matching artifact schemas for the node', async () => {
  const { startRun, assembleNodePrompt } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  await mkdir(join(root, 'schemas'), { recursive: true })
  writeFileSync(join(root, 'schemas', '10_hotspot_scan.candidates.schema.json'), JSON.stringify({
    type: 'array',
    minItems: 1,
  }), 'utf8')
  startRun(root, { runId: 'schema-prompt-run' })

  const prompt = assembleNodePrompt(root, 'schema-prompt-run', '10_hotspot_scan')

  assert.match(prompt, /Node Artifact Schemas/)
  assert.match(prompt, /schemas\/10_hotspot_scan\.candidates\.schema\.json/)
  assert.match(prompt, /"minItems": 1/)
})

test('run events are appended as JSONL during start and step', async () => {
  const { readRunEvents, startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)

  startRun(root, { runId: 'event-run' })
  stepRun(root, { runId: 'event-run', outcome: 'pass' })

  const events = readRunEvents(root, 'event-run')
  assert.deepEqual(events.map(event => event.type), [
    'run_started',
    'node_step_started',
    'prompt_assembled',
    'execution_completed',
    'gate_recorded',
    'routed',
  ])
  assert.equal(events[1].nodeId, '10_hotspot_scan')
  assert.equal(events[5].to, '20_topic_gate')
})

test('validateArtifactFile accepts a node artifact that matches its schema', async () => {
  const { validateArtifactFile } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  await mkdir(join(root, 'schemas'), { recursive: true })
  await mkdir(join(root, '.runs', 'schema-run', 'nodes', '10_hotspot_scan'), { recursive: true })
  writeFileSync(join(root, 'schemas', '10_hotspot_scan.candidates.schema.json'), JSON.stringify({
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      required: ['title', 'sourceUrls', 'paperOnly'],
      properties: {
        title: { type: 'string', minLength: 1 },
        sourceUrls: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        paperOnly: { type: 'boolean' },
      },
    },
  }), 'utf8')
  writeFileSync(join(root, '.runs', 'schema-run', 'nodes', '10_hotspot_scan', 'candidates.json'), JSON.stringify([
    { title: 'Community hotspot', sourceUrls: ['https://example.com'], paperOnly: false },
  ]), 'utf8')

  const result = validateArtifactFile(root, 'schema-run', '10_hotspot_scan', 'candidates.json')

  assert.equal(result.ok, true)
  assert.equal(result.schema, 'schemas/10_hotspot_scan.candidates.schema.json')
  assert.deepEqual(result.errors, [])
})

test('validateArtifactFile reports schema errors for invalid artifacts', async () => {
  const { validateArtifactFile } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  await mkdir(join(root, 'schemas'), { recursive: true })
  await mkdir(join(root, '.runs', 'schema-fail', 'nodes', '10_hotspot_scan'), { recursive: true })
  writeFileSync(join(root, 'schemas', '10_hotspot_scan.candidates.schema.json'), JSON.stringify({
    type: 'array',
    minItems: 1,
    items: {
      type: 'object',
      required: ['title', 'sourceUrls', 'paperOnly'],
      properties: {
        title: { type: 'string', minLength: 1 },
        sourceUrls: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
        paperOnly: { type: 'boolean' },
      },
    },
  }), 'utf8')
  writeFileSync(join(root, '.runs', 'schema-fail', 'nodes', '10_hotspot_scan', 'candidates.json'), JSON.stringify([
    { title: '', sourceUrls: [], paperOnly: 'no' },
  ]), 'utf8')

  const result = validateArtifactFile(root, 'schema-fail', '10_hotspot_scan', 'candidates.json')

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /title/)
  assert.match(result.errors.join('\n'), /sourceUrls/)
  assert.match(result.errors.join('\n'), /paperOnly/)
})

test('10_hotspot_scan dry-run can copy a candidate fixture into a validated artifact', async () => {
  const { startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  await writeHotspotSchemas(root)
  const fixturePath = await writeCandidateFixture(root)
  startRun(root, { runId: 'fixture-scan' })

  const result = stepRun(root, { runId: 'fixture-scan', fixture: fixturePath })

  assert.equal(result.gate.outcome, 'pass')
  assert.equal(result.gate.artifacts[0], 'candidates.json')
  assert.equal(result.gate.artifactValidation[0].ok, true)
  assert.equal(result.manifest.currentNode, '20_topic_gate')
  assert.ok(existsSync(join(root, '.runs', 'fixture-scan', 'nodes', '10_hotspot_scan', 'candidates.json')))
})

test('20_topic_gate dry-run consumes scan candidates and produces a validated scorecard', async () => {
  const { startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeRunnableHarness(root)
  await writeHotspotSchemas(root)
  const fixturePath = await writeCandidateFixture(root)
  startRun(root, { runId: 'fixture-topic' })
  stepRun(root, { runId: 'fixture-topic', fixture: fixturePath })

  const result = stepRun(root, { runId: 'fixture-topic' })
  const scorecard = JSON.parse(readFileSync(join(root, '.runs', 'fixture-topic', 'nodes', '20_topic_gate', 'topic-scorecard.json'), 'utf8'))

  assert.equal(result.nodeId, '20_topic_gate')
  assert.equal(result.gate.outcome, 'pass')
  assert.equal(result.gate.artifacts[0], 'topic-scorecard.json')
  assert.equal(result.gate.artifactValidation[0].ok, true)
  assert.equal(result.manifest.status, 'completed')
  assert.equal(scorecard.chosenTitle, 'Community demo hotspot')
  assert.ok(existsSync(join(root, '.runs', 'fixture-topic', 'nodes', '20_topic_gate', 'selected-topic.md')))
})

test('30_source_collect dry-run consumes topic scorecard and produces a validated source inventory', async () => {
  const { startRun, stepRun } = await import(runnerUrl)
  const root = makeHarnessRoot()
  await writeThreeNodeHarness(root)
  await writeHotspotSchemas(root)
  const candidateFixture = await writeCandidateFixture(root)
  const sourceFixture = await writeSourceFixture(root)
  startRun(root, { runId: 'fixture-source' })
  stepRun(root, { runId: 'fixture-source', fixture: candidateFixture })
  stepRun(root, { runId: 'fixture-source' })

  const result = stepRun(root, { runId: 'fixture-source', fixture: sourceFixture })
  const inventory = JSON.parse(readFileSync(join(root, '.runs', 'fixture-source', 'nodes', '30_source_collect', 'source-inventory.json'), 'utf8'))

  assert.equal(result.nodeId, '30_source_collect')
  assert.equal(result.gate.outcome, 'pass')
  assert.equal(result.gate.artifacts[0], 'source-inventory.json')
  assert.equal(result.gate.artifactValidation[0].ok, true)
  assert.equal(result.manifest.status, 'completed')
  assert.equal(inventory.sources.length, 2)
  assert.ok(existsSync(join(root, '.runs', 'fixture-source', 'nodes', '30_source_collect', 'source-inventory.md')))
  assert.ok(existsSync(join(root, '.runs', 'fixture-source', 'nodes', '30_source_collect', 'source-gaps.md')))
})
