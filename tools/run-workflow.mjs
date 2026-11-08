import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  REQUIRED_NODE_FILES,
  TERMINAL_NODES,
  activeNodeFromLoop,
  isDirectRun,
  nodeById,
  parseWorkflow,
  readGateOutcomes,
  readLoop,
  routeForOutcome,
  toSlash,
  validateLoop,
} from './loop-lib.mjs'

const DEFAULT_SANDBOX = process.env.CODEX_RUNNER_SANDBOX || 'danger-full-access'

function nowIso() {
  return new Date().toISOString()
}

function defaultRunId() {
  return `run-${nowIso().replace(/[:.]/g, '-')}`
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) {
      args._.push(item)
      continue
    }
    const key = item.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    index += 1
  }
  return args
}

function runDir(projectRoot, runId) {
  return resolve(projectRoot, '.runs', runId)
}

function manifestPath(projectRoot, runId) {
  return join(runDir(projectRoot, runId), 'manifest.json')
}

function nodeRunDir(projectRoot, runId, nodeId) {
  return join(runDir(projectRoot, runId), 'nodes', nodeId)
}

function eventsPath(projectRoot, runId) {
  return join(runDir(projectRoot, runId), 'events.jsonl')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export function appendRunEvent(projectRoot, runId, type, data = {}) {
  const event = {
    at: nowIso(),
    runId,
    type,
    ...data,
  }
  mkdirSync(runDir(projectRoot, runId), { recursive: true })
  appendFileSync(eventsPath(projectRoot, runId), `${JSON.stringify(event)}\n`, 'utf8')
  return event
}

export function readRunEvents(projectRoot, runId) {
  const path = eventsPath(projectRoot, runId)
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

function writeCurrentNode(projectRoot, runId, manifest) {
  const body = [
    `# Current Node`,
    ``,
    `- run_id: ${manifest.runId}`,
    `- status: ${manifest.status}`,
    `- current_node: ${manifest.currentNode || ''}`,
    `- updated_at: ${manifest.updatedAt}`,
    ``,
  ].join('\n')
  writeFileSync(join(runDir(projectRoot, runId), 'current-node.md'), body, 'utf8')
}

function loadManifest(projectRoot, runId) {
  const path = manifestPath(projectRoot, runId)
  if (!existsSync(path)) throw new Error(`run not found: ${runId}`)
  return readJson(path)
}

function saveManifest(projectRoot, runId, manifest) {
  manifest.updatedAt = nowIso()
  writeJson(manifestPath(projectRoot, runId), manifest)
  writeCurrentNode(projectRoot, runId, manifest)
}

export function latestRunId(projectRoot = process.cwd()) {
  const root = resolve(projectRoot)
  const runsRoot = join(root, '.runs')
  if (!existsSync(runsRoot)) return null
  const runs = readdirSync(runsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const path = manifestPath(root, entry.name)
      if (!existsSync(path)) return null
      return { runId: entry.name, updatedAt: readJson(path).updatedAt || '' }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return runs[0]?.runId || null
}

export function startRun(projectRoot = process.cwd(), options = {}) {
  const root = resolve(projectRoot)
  const validation = validateLoop(root)
  if (!validation.ok) throw new Error(`loop invalid:\n${validation.errors.join('\n')}`)

  const loop = readLoop(root)
  const workflow = parseWorkflow(loop)
  const runId = options.runId || defaultRunId()
  const currentNode = options.node || activeNodeFromLoop(loop, workflow)
  if (!currentNode) throw new Error('cannot determine active node')
  if (!nodeById(workflow, currentNode)) throw new Error(`unknown node: ${currentNode}`)

  const dir = runDir(root, runId)
  if (existsSync(dir) && !options.force) throw new Error(`run already exists: ${runId}`)
  mkdirSync(join(dir, 'nodes'), { recursive: true })

  const manifest = {
    runId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: 'running',
    currentNode,
    graph: {
      activeNode: currentNode,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
    },
    history: [],
    nodes: {},
  }
  saveManifest(root, runId, manifest)
  appendRunEvent(root, runId, 'run_started', { nodeId: currentNode })
  return manifest
}

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function nodeSchemaFiles(projectRoot, nodeId) {
  const schemaDir = resolve(projectRoot, 'schemas')
  if (!existsSync(schemaDir)) return []
  return readdirSync(schemaDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => name.startsWith(`${nodeId}.`) && name.endsWith('.schema.json'))
    .sort()
    .map(name => ({
      path: toSlash(join('schemas', name)),
      body: formatJsonForPrompt(readIfExists(resolve(schemaDir, name))),
    }))
}

function formatJsonForPrompt(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function assembleNodePrompt(projectRoot = process.cwd(), runId, nodeId) {
  const root = resolve(projectRoot)
  const loop = readLoop(root)
  const workflow = parseWorkflow(loop)
  const node = nodeById(workflow, nodeId)
  if (!node) throw new Error(`unknown node: ${nodeId}`)
  const folder = node.folder || `modules/${nodeId}`
  const manifest = loadManifest(root, runId)

  const nodeFiles = REQUIRED_NODE_FILES.map(file => ({
    file,
    path: toSlash(join(folder, file)),
    body: readIfExists(resolve(root, folder, file)),
  }))
  const schemaFiles = nodeSchemaFiles(root, nodeId)

  return [
    `# Agent Workflow Node Execution Prompt`,
    ``,
    `You are executing one node in a file-based Agent workflow harness.`,
    `The text files are the source of truth. Do not infer workflow behavior from chat history.`,
    ``,
    `## Non-Negotiable Runtime Rules`,
    ``,
    `- Current run id: ${runId}`,
    `- Current node: ${nodeId}`,
    `- Stay inside this node's declared scope.`,
    `- Do not publish, upload, edit account settings, or touch external credentials.`,
    `- Write artifacts only under .runs/${runId}/nodes/${nodeId}/ when the node contract asks for artifacts.`,
    `- If required inputs, source bindings, API keys, or human decisions are missing, return outcome "pause".`,
    `- Do not invoke optional skills, internet search, browser automation, or external CLIs unless the current run manifest or node inputs provide a concrete source binding or supplied candidate artifact.`,
    `- For a smoke run with no source binding, pause immediately and explain the missing binding.`,
    `- End your final answer with exactly one fenced json block containing outcome, reason, and artifacts.`,
    ``,
    '```json',
    JSON.stringify({ outcome: 'pass|pause|fail', reason: 'short reason', artifacts: [] }, null, 2),
    '```',
    ``,
    `## Root AGENTS.md`,
    ``,
    readIfExists(resolve(root, 'AGENTS.md')),
    ``,
    `## LOOP.md`,
    ``,
    loop,
    ``,
    `## Current Run Manifest`,
    ``,
    '```json',
    JSON.stringify(manifest, null, 2),
    '```',
    ``,
    `## Node Artifact Schemas`,
    ``,
    schemaFiles.length === 0
      ? `No schemas registered for ${nodeId}.`
      : schemaFiles.flatMap(item => [
        `### ${item.path}`,
        ``,
        '```json',
        item.body,
        '```',
      ]).join('\n'),
    ``,
    ...nodeFiles.flatMap(item => [
      `## ${item.path}`,
      ``,
      item.body,
      ``,
    ]),
  ].join('\n')
}

export function extractGateResult(text) {
  const fenced = [...String(text || '').matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
  for (const match of fenced.reverse()) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed && typeof parsed.outcome === 'string') return normalizeGateResult(parsed)
    } catch {
      // Continue looking for a parseable block.
    }
  }

  const objectMatch = String(text || '').match(/\{[\s\S]*"outcome"[\s\S]*\}/)
  if (objectMatch) {
    try {
      return normalizeGateResult(JSON.parse(objectMatch[0]))
    } catch {
      // Fall through to null.
    }
  }
  return null
}

function normalizeGateResult(result) {
  return {
    outcome: String(result.outcome || '').trim(),
    reason: String(result.reason || '').trim(),
    artifacts: Array.isArray(result.artifacts) ? result.artifacts.map(String) : [],
  }
}

function dryRunOutput(outcome) {
  return [
    `Dry-run mode did not call Codex.`,
    `It only proves prompt assembly, gate recording, and routing.`,
    ``,
    '```json',
    JSON.stringify({
      outcome,
      reason: `dry-run selected ${outcome}`,
      artifacts: [],
    }, null, 2),
    '```',
    ``,
  ].join('\n')
}

function gateOutput(outcome, reason, artifacts = []) {
  return [
    `Dry-run node adapter completed.`,
    ``,
    '```json',
    JSON.stringify({ outcome, reason, artifacts }, null, 2),
    '```',
    ``,
  ].join('\n')
}

function runHotspotScanDryRun(projectRoot, runId, nodeDir, options) {
  if (!options.fixture) return null
  const fixturePath = resolve(projectRoot, options.fixture)
  if (!existsSync(fixturePath)) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('fail', `fixture not found: ${options.fixture}`),
      stderr: '',
      final: '',
    }
  }
  const candidates = readJson(fixturePath)
  writeJson(join(nodeDir, 'candidates.json'), candidates)
  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '10_hotspot_scan',
    artifact: toSlash(join('.runs', runId, 'nodes', '10_hotspot_scan', 'candidates.json')),
    source: toSlash(options.fixture),
  })
  return {
    status: 0,
    error: '',
    stdout: gateOutput('pass', 'candidate fixture copied into run artifact', ['candidates.json']),
    stderr: '',
    final: '',
  }
}

function pickTopicCandidate(candidates) {
  return candidates.find(candidate => !candidate.paperOnly && !candidate.duplicateRisk) || null
}

function runTopicGateDryRun(projectRoot, runId, nodeDir) {
  const candidatesPath = join(nodeRunDir(projectRoot, runId, '10_hotspot_scan'), 'candidates.json')
  if (!existsSync(candidatesPath)) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('fail', '10_hotspot_scan candidates artifact missing'),
      stderr: '',
      final: '',
    }
  }

  const candidates = readJson(candidatesPath)
  const selected = pickTopicCandidate(candidates)
  if (!selected) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('pause', 'no non-paper non-duplicate candidate clears the dry-run gate'),
      stderr: '',
      final: '',
    }
  }

  const rejectedAlternatives = candidates
    .filter(candidate => candidate.title !== selected.title)
    .map(candidate => candidate.title)
  const scorecard = {
    chosenTitle: selected.title,
    selectionReason: selected.conflictOrImpact,
    interactionPotential: selected.communitySignal,
    duplicateCheck: selected.duplicateRisk ? 'duplicate risk present' : 'no duplicate risk flagged in candidate artifact',
    paperSourceDecision: selected.paperOnly ? 'paper-only candidates are rejected' : 'not paper-only; eligible for cold-start recommendation budget',
    dailyBudgetDecision: 'advance one topic for this run; keep daily main article budget protected',
    rejectedAlternatives,
  }

  writeJson(join(nodeDir, 'topic-scorecard.json'), scorecard)
  writeFileSync(join(nodeDir, 'selected-topic.md'), [
    `# Selected Topic`,
    ``,
    `## Chosen Title`,
    ``,
    selected.title,
    ``,
    `## Selection Reason`,
    ``,
    selected.conflictOrImpact,
    ``,
    `## Interaction Potential`,
    ``,
    selected.communitySignal,
    ``,
  ].join('\n'), 'utf8')
  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '20_topic_gate',
    artifact: toSlash(join('.runs', runId, 'nodes', '20_topic_gate', 'topic-scorecard.json')),
  })
  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '20_topic_gate',
    artifact: toSlash(join('.runs', runId, 'nodes', '20_topic_gate', 'selected-topic.md')),
  })

  return {
    status: 0,
    error: '',
    stdout: gateOutput('pass', 'selected topic from upstream candidate artifact', ['topic-scorecard.json', 'selected-topic.md']),
    stderr: '',
    final: '',
  }
}

function renderSourceInventoryMarkdown(inventory) {
  const lines = [
    '# Source Inventory',
    '',
    `## Topic`,
    '',
    inventory.topicTitle,
    '',
    '## Sources',
    '',
  ]
  for (const source of inventory.sources || []) {
    lines.push(
      `### ${source.title}`,
      '',
      `- url: ${source.url}`,
      `- type: ${source.sourceType}`,
      `- captured_at: ${source.capturedAt}`,
      `- credibility: ${source.credibility}`,
      `- usable: ${source.usable}`,
      '',
      source.keyClaim,
      '',
    )
  }
  return lines.join('\n')
}

function renderSourceGapsMarkdown(inventory) {
  const gaps = inventory.gaps || []
  return [
    '# Source Gaps',
    '',
    ...(gaps.length === 0 ? ['- None flagged in fixture.'] : gaps.map(gap => `- ${gap}`)),
    '',
  ].join('\n')
}

function runSourceCollectDryRun(projectRoot, runId, nodeDir, options) {
  const scorecardPath = join(nodeRunDir(projectRoot, runId, '20_topic_gate'), 'topic-scorecard.json')
  if (!existsSync(scorecardPath)) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('fail', '20_topic_gate topic-scorecard artifact missing'),
      stderr: '',
      final: '',
    }
  }
  if (!options.fixture) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('pause', 'source fixture missing for 30_source_collect dry-run'),
      stderr: '',
      final: '',
    }
  }

  const fixturePath = resolve(projectRoot, options.fixture)
  if (!existsSync(fixturePath)) {
    return {
      status: 0,
      error: '',
      stdout: gateOutput('fail', `source fixture not found: ${options.fixture}`),
      stderr: '',
      final: '',
    }
  }

  const scorecard = readJson(scorecardPath)
  const inventory = readJson(fixturePath)
  const normalizedInventory = {
    ...inventory,
    topicTitle: inventory.topicTitle || scorecard.chosenTitle,
  }

  mkdirSync(join(nodeDir, 'sources'), { recursive: true })
  writeJson(join(nodeDir, 'source-inventory.json'), normalizedInventory)
  writeFileSync(join(nodeDir, 'source-inventory.md'), renderSourceInventoryMarkdown(normalizedInventory), 'utf8')
  writeFileSync(join(nodeDir, 'source-gaps.md'), renderSourceGapsMarkdown(normalizedInventory), 'utf8')

  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '30_source_collect',
    artifact: toSlash(join('.runs', runId, 'nodes', '30_source_collect', 'source-inventory.json')),
    source: toSlash(options.fixture),
  })
  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '30_source_collect',
    artifact: toSlash(join('.runs', runId, 'nodes', '30_source_collect', 'source-inventory.md')),
  })
  appendRunEvent(projectRoot, runId, 'artifact_written', {
    nodeId: '30_source_collect',
    artifact: toSlash(join('.runs', runId, 'nodes', '30_source_collect', 'source-gaps.md')),
  })

  const usableSources = (normalizedInventory.sources || []).filter(source => source.usable)
  const outcome = usableSources.length > 0 ? 'pass' : 'pause'
  const reason = usableSources.length > 0
    ? 'source fixture converted into source inventory'
    : 'source fixture has no usable sources'

  return {
    status: 0,
    error: '',
    stdout: gateOutput(outcome, reason, ['source-inventory.json', 'source-inventory.md', 'source-gaps.md']),
    stderr: '',
    final: '',
  }
}

function runDryNode(projectRoot, runId, nodeId, nodeDir, options) {
  if (nodeId === '10_hotspot_scan') {
    const scanResult = runHotspotScanDryRun(projectRoot, runId, nodeDir, options)
    if (scanResult) return scanResult
  }
  if (nodeId === '20_topic_gate') return runTopicGateDryRun(projectRoot, runId, nodeDir)
  if (nodeId === '30_source_collect') return runSourceCollectDryRun(projectRoot, runId, nodeDir, options)
  return { status: 0, error: '', stdout: dryRunOutput(options.outcome || 'pause'), stderr: '', final: '' }
}

function resolveCodexCommand() {
  if (process.env.CODEX_CLI_PATH) return process.env.CODEX_CLI_PATH
  if (process.platform !== 'win32') return 'codex'

  for (const candidate of ['codex.cmd', 'codex.exe', 'codex']) {
    const result = spawnSync('where.exe', [candidate], { encoding: 'utf8' })
    const first = String(result.stdout || '').split(/\r?\n/).find(Boolean)
    if (result.status === 0 && first) return first
  }
  return 'codex'
}

function resolveCodexInvocation() {
  const command = resolveCodexCommand()
  if (process.platform !== 'win32' || !command.toLowerCase().endsWith('.cmd')) {
    return { command, prefixArgs: [], shell: false }
  }

  const nodePath = join(dirname(command), 'node.exe')
  const scriptPath = join(dirname(command), 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
  if (existsSync(nodePath) && existsSync(scriptPath)) {
    return { command: nodePath, prefixArgs: [scriptPath], shell: false }
  }
  return { command, prefixArgs: [], shell: true }
}

function runCodex(projectRoot, prompt, nodeDir, options) {
  const finalPath = join(nodeDir, 'final.md')
  const invocation = resolveCodexInvocation()
  const args = [
    'exec',
    '--cd', projectRoot,
    '--sandbox', options.sandbox || DEFAULT_SANDBOX,
    '--color', 'never',
  ]
  if (options.model) args.push('--model', options.model)
  args.push('--output-last-message', finalPath)
  args.push('-')

  const result = spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    cwd: projectRoot,
    input: prompt,
    encoding: 'utf8',
    shell: invocation.shell,
    timeout: Number(options.timeoutMs || process.env.CODEX_RUNNER_TIMEOUT_MS || 120000),
    maxBuffer: 1024 * 1024 * 20,
  })

  return {
    status: result.status,
    error: result.error?.message || '',
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    final: readIfExists(finalPath),
  }
}

function statusForTarget(target, outcome) {
  if (target === 'HUMAN') return 'paused'
  if (target === 'END') return outcome === 'pass' ? 'completed' : 'failed'
  return 'running'
}

function artifactAbsolutePath(projectRoot, runId, nodeId, artifactPath) {
  const normalized = toSlash(String(artifactPath || '').trim())
  if (!normalized) throw new Error('artifact path is required')
  if (normalized.startsWith('.runs/')) return resolve(projectRoot, normalized)
  return resolve(nodeRunDir(projectRoot, runId, nodeId), normalized)
}

function artifactSchemaPath(projectRoot, nodeId, artifactPath) {
  const artifactName = String(artifactPath || '').split(/[\\/]/).pop() || ''
  const stem = artifactName.replace(/\.json$/i, '')
  return resolve(projectRoot, 'schemas', `${nodeId}.${stem}.schema.json`)
}

function typeName(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function validateValue(value, schema, path = '$') {
  const errors = []
  if (!schema || typeof schema !== 'object') return errors

  if (schema.type && typeName(value) !== schema.type) {
    errors.push(`${path} expected ${schema.type}, got ${typeName(value)}`)
    return errors
  }

  if (schema.type === 'string' && typeof schema.minLength === 'number' && value.length < schema.minLength) {
    errors.push(`${path} must have length >= ${schema.minLength}`)
  }

  if (schema.type === 'array') {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${path} must have at least ${schema.minItems} item(s)`)
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateValue(item, schema.items, `${path}[${index}]`))
      })
    }
  }

  if (schema.type === 'object') {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}.${key} is required`)
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validateValue(value[key], childSchema, `${path}.${key}`))
      }
    }
  }

  return errors
}

export function validateArtifactFile(projectRoot, runId, nodeId, artifactPath) {
  const root = resolve(projectRoot)
  const absoluteArtifactPath = artifactAbsolutePath(root, runId, nodeId, artifactPath)
  const absoluteSchemaPath = artifactSchemaPath(root, nodeId, artifactPath)
  const schemaRel = toSlash(absoluteSchemaPath.replace(`${root}\\`, '').replace(`${root}/`, ''))
  const artifactRel = toSlash(absoluteArtifactPath.replace(`${root}\\`, '').replace(`${root}/`, ''))

  if (!existsSync(absoluteArtifactPath)) {
    return { ok: false, artifact: artifactRel, schema: existsSync(absoluteSchemaPath) ? schemaRel : null, errors: ['artifact missing'] }
  }
  if (!existsSync(absoluteSchemaPath)) {
    return { ok: true, artifact: artifactRel, schema: null, skipped: true, errors: [] }
  }

  let artifact
  let schema
  try {
    artifact = readJson(absoluteArtifactPath)
  } catch (error) {
    return { ok: false, artifact: artifactRel, schema: schemaRel, errors: [`artifact json invalid: ${error.message}`] }
  }
  try {
    schema = readJson(absoluteSchemaPath)
  } catch (error) {
    return { ok: false, artifact: artifactRel, schema: schemaRel, errors: [`schema json invalid: ${error.message}`] }
  }

  const errors = validateValue(artifact, schema)
  return { ok: errors.length === 0, artifact: artifactRel, schema: schemaRel, errors }
}

function validateGateArtifacts(projectRoot, runId, nodeId, artifacts) {
  return artifacts.map(artifact => validateArtifactFile(projectRoot, runId, nodeId, artifact))
}

export function stepRun(projectRoot = process.cwd(), options = {}) {
  const root = resolve(projectRoot)
  const runId = options.runId || latestRunId(root)
  if (!runId) throw new Error('no run id supplied and no prior run exists')

  const validation = validateLoop(root)
  if (!validation.ok) throw new Error(`loop invalid:\n${validation.errors.join('\n')}`)

  const loop = readLoop(root)
  const workflow = parseWorkflow(loop)
  const manifest = loadManifest(root, runId)
  if (manifest.status !== 'running') {
    return { runId, status: manifest.status, currentNode: manifest.currentNode, skipped: true }
  }
  const nodeId = manifest.currentNode
  if (TERMINAL_NODES.has(nodeId)) throw new Error(`cannot execute terminal node: ${nodeId}`)

  const node = nodeById(workflow, nodeId)
  if (!node) throw new Error(`unknown current node: ${nodeId}`)
  appendRunEvent(root, runId, 'node_step_started', { nodeId })

  const nodeDir = nodeRunDir(root, runId, nodeId)
  mkdirSync(join(nodeDir, 'artifacts'), { recursive: true })
  const prompt = assembleNodePrompt(root, runId, nodeId)
  writeFileSync(join(nodeDir, 'prompt.md'), prompt, 'utf8')
  appendRunEvent(root, runId, 'prompt_assembled', {
    nodeId,
    path: toSlash(join('.runs', runId, 'nodes', nodeId, 'prompt.md')),
  })

  const mode = options.exec ? 'exec' : 'dry-run'
  const execution = mode === 'exec'
    ? runCodex(root, prompt, nodeDir, options)
    : runDryNode(root, runId, nodeId, nodeDir, options)

  writeFileSync(join(nodeDir, 'stdout.md'), execution.stdout, 'utf8')
  writeFileSync(join(nodeDir, 'stderr.md'), execution.stderr, 'utf8')
  if (execution.error) writeFileSync(join(nodeDir, 'error.txt'), execution.error, 'utf8')
  appendRunEvent(root, runId, 'execution_completed', {
    nodeId,
    mode,
    codexStatus: execution.status,
    error: execution.error || undefined,
  })

  const combined = [execution.final, execution.stdout].filter(Boolean).join('\n')
  let gate = extractGateResult(combined)
  if (!gate) {
    gate = {
      outcome: 'pause',
      reason: 'gate result missing or not parseable',
      artifacts: [],
    }
  }

  const outcomes = new Set(readGateOutcomes(root, node.gate || toSlash(join(node.folder, 'GATE.md'))) || [])
  if (!outcomes.has(gate.outcome)) {
    throw new Error(`gate outcome not declared for ${nodeId}: ${gate.outcome}`)
  }
  const route = routeForOutcome(workflow, nodeId, gate.outcome)
  if (!route) throw new Error(`no route for ${nodeId}.${gate.outcome}`)
  const artifactValidation = validateGateArtifacts(root, runId, nodeId, gate.artifacts)

  const gateRecord = {
    runId,
    nodeId,
    mode,
    codexStatus: execution.status,
    outcome: gate.outcome,
    reason: gate.reason,
    artifacts: gate.artifacts,
    artifactValidation,
    next: route.to,
    recordedAt: nowIso(),
  }
  writeJson(join(nodeDir, 'gate-result.json'), gateRecord)
  writeFileSync(join(nodeDir, 'gate-result.md'), [
    `# Gate Result`,
    ``,
    `- node: ${nodeId}`,
    `- outcome: ${gateRecord.outcome}`,
    `- next: ${gateRecord.next}`,
    `- mode: ${gateRecord.mode}`,
    `- reason: ${gateRecord.reason}`,
    ``,
  ].join('\n'), 'utf8')
  appendRunEvent(root, runId, 'gate_recorded', {
    nodeId,
    outcome: gateRecord.outcome,
    next: route.to,
    artifacts: gateRecord.artifacts,
    artifactValidation,
  })

  manifest.nodes[nodeId] = {
    status: gateRecord.outcome,
    next: route.to,
    gate: toSlash(join('.runs', runId, 'nodes', nodeId, 'gate-result.json')),
    updatedAt: gateRecord.recordedAt,
  }
  manifest.history.push({
    node: nodeId,
    outcome: gateRecord.outcome,
    next: route.to,
    at: gateRecord.recordedAt,
  })
  manifest.currentNode = TERMINAL_NODES.has(route.to) ? null : route.to
  manifest.status = statusForTarget(route.to, gateRecord.outcome)
  saveManifest(root, runId, manifest)
  appendRunEvent(root, runId, 'routed', {
    nodeId,
    outcome: gateRecord.outcome,
    to: route.to,
    status: manifest.status,
    currentNode: manifest.currentNode,
  })

  return { runId, nodeId, gate: gateRecord, manifest }
}

export function inspectRun(projectRoot = process.cwd(), runId = latestRunId(projectRoot)) {
  if (!runId) throw new Error('no run id supplied and no prior run exists')
  return loadManifest(projectRoot, runId)
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

if (isDirectRun(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)
  const root = process.cwd()

  try {
    if (command === 'start') {
      print(startRun(root, { runId: args.run, node: args.node, force: Boolean(args.force) }))
    } else if (command === 'step') {
      print(stepRun(root, {
        runId: args.run,
        exec: Boolean(args.exec),
        sandbox: args.sandbox,
        model: args.model,
        timeoutMs: args['timeout-ms'],
        outcome: args.outcome,
        fixture: args.fixture,
      }))
    } else if (command === 'inspect') {
      print(inspectRun(root, args.run))
    } else {
      throw new Error('usage: node tools/run-workflow.mjs <start|step|inspect> [--run id] [--node node] [--exec] [--sandbox mode] [--model model] [--timeout-ms ms] [--outcome pass|pause|fail] [--fixture path]')
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
