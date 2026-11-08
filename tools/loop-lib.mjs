import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const REQUIRED_NODE_FILES = ['AGENTS.md', 'NODE.md', 'SYSTEM.md', 'CONTRACT.md', 'GATE.md']
export const REGISTRY_FILES = ['skills/registry.md', 'plugins/registry.md', 'agents/registry.md']
export const TERMINAL_NODES = new Set(['HUMAN', 'END'])

export function toSlash(path) {
  return path.replace(/\\/g, '/')
}

function stripCell(value) {
  return String(value || '').trim().replace(/^`|`$/g, '').trim()
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

export function readProjectText(projectRoot, relativePath) {
  return readText(resolve(projectRoot, relativePath))
}

export function readLoop(projectRoot) {
  const loopPath = resolve(projectRoot, 'LOOP.md')
  if (!existsSync(loopPath)) throw new Error(`missing LOOP.md: ${loopPath}`)
  return readText(loopPath)
}

function sectionBody(markdown, title) {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex(line => line.trim() === `## ${title}`)
  if (start === -1) return ''
  const body = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break
    body.push(line)
  }
  return body.join('\n')
}

function parseMarkdownTable(markdown, title) {
  const body = sectionBody(markdown, title)
  const rows = body.split(/\r?\n/).filter(line => /^\s*\|.*\|\s*$/.test(line))
  if (rows.length < 2) return []
  const headers = rows[0].split('|').slice(1, -1).map(stripCell)
  return rows.slice(2).map(row => {
    const cells = row.split('|').slice(1, -1).map(stripCell)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']))
  })
}

export function parseWorkflow(markdown) {
  const nodes = parseMarkdownTable(markdown, 'Node Index').map(row => ({
    id: row.Node,
    folder: row.Folder.replace(/\/$/, ''),
    purpose: row.Purpose,
    gate: row.Gate,
  })).filter(node => node.id)

  const edges = parseMarkdownTable(markdown, 'Edge Index').map(row => ({
    from: row.From,
    outcome: row.Outcome,
    to: row.To,
    meaning: row.Meaning,
  })).filter(edge => edge.from && edge.outcome && edge.to)

  return { nodes, edges }
}

export function activeNodeFromLoop(markdown, workflow = parseWorkflow(markdown)) {
  const match = markdown.match(/active_node:\s*`?([^`\r\n]+)`?/)
  if (!match) return workflow.nodes[0]?.id || null
  const active = stripCell(match[1]).replace(/\/$/, '')
  const byFolder = workflow.nodes.find(node => node.folder.replace(/\/$/, '') === active)
  if (byFolder) return byFolder.id
  const byModuleFolder = workflow.nodes.find(node => `modules/${node.id}` === active)
  if (byModuleFolder) return byModuleFolder.id
  const byId = workflow.nodes.find(node => node.id === active)
  return byId?.id || null
}

export function nodeById(workflow, nodeId) {
  return workflow.nodes.find(node => node.id === nodeId) || null
}

export function routeForOutcome(workflow, nodeId, outcome) {
  return workflow.edges.find(edge => edge.from === nodeId && edge.outcome === outcome) || null
}

export function readGateOutcomes(projectRoot, gatePath) {
  const resolved = resolve(projectRoot, gatePath)
  if (!existsSync(resolved)) return null
  const markdown = readText(resolved)
  return markdown
    .split(/\r?\n/)
    .map(line => line.match(/^\s*-\s+`?([A-Za-z0-9_-]+)`?/))
    .filter(Boolean)
    .map(match => match[1])
}

export function validateLoop(projectRoot = process.cwd()) {
  const root = resolve(projectRoot)
  const errors = []
  let workflow = { nodes: [], edges: [] }

  try {
    workflow = parseWorkflow(readLoop(root))
  } catch (error) {
    errors.push(error.message)
  }

  if (workflow.nodes.length === 0) errors.push('LOOP.md has no Node Index rows')

  const nodeIds = new Set(workflow.nodes.map(node => node.id))
  const outcomesByNode = new Map()

  for (const registry of REGISTRY_FILES) {
    if (!existsSync(resolve(root, registry))) errors.push(`missing registry: ${registry}`)
  }

  for (const node of workflow.nodes) {
    const folder = node.folder || `modules/${node.id}`
    for (const file of REQUIRED_NODE_FILES) {
      const rel = toSlash(join(folder, file))
      if (!existsSync(resolve(root, rel))) errors.push(`missing node file: ${rel}`)
    }
    const gatePath = node.gate || toSlash(join(folder, 'GATE.md'))
    const outcomes = readGateOutcomes(root, gatePath)
    if (outcomes === null) {
      errors.push(`missing gate file: ${gatePath}`)
    } else {
      outcomesByNode.set(node.id, new Set(outcomes))
    }
  }

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from)) errors.push(`edge starts from unknown node: ${edge.from}`)
    if (!nodeIds.has(edge.to) && !TERMINAL_NODES.has(edge.to)) {
      errors.push(`edge targets unknown node: ${edge.to}`)
    }
    const outcomes = outcomesByNode.get(edge.from)
    if (outcomes && !outcomes.has(edge.outcome)) {
      errors.push(`edge outcome missing from gate: ${edge.from}.${edge.outcome}`)
    }
  }

  return { ok: errors.length === 0, errors, nodes: workflow.nodes, edges: workflow.edges }
}

export function exportWorkflowData(projectRoot = process.cwd()) {
  const root = resolve(projectRoot)
  const workflow = parseWorkflow(readLoop(root))
  return {
    generatedAt: new Date().toISOString(),
    graph: workflow,
    modules: workflow.nodes.map(node => {
      const folder = node.folder || `modules/${node.id}`
      return {
        id: node.id,
        folder,
        purpose: node.purpose,
        gate: node.gate,
        files: REQUIRED_NODE_FILES.map(name => {
          const path = toSlash(join(folder, name))
          return {
            name,
            path,
            exists: existsSync(resolve(root, path)),
          }
        }),
      }
    }),
    registries: REGISTRY_FILES.map(path => ({
      path,
      exists: existsSync(resolve(root, path)),
    })),
  }
}

export function mermaidFromWorkflow(workflow) {
  const lines = ['flowchart TD']
  const declaredTerminalNodes = new Set()
  for (const node of workflow.nodes) {
    lines.push(`  ${node.id}["${node.id}<br/>${node.purpose || ''}"]`)
  }
  for (const edge of workflow.edges) {
    if (TERMINAL_NODES.has(edge.to) && !declaredTerminalNodes.has(edge.to)) {
      declaredTerminalNodes.add(edge.to)
      lines.push(`  ${edge.to}["${edge.to}"]`)
    }
    lines.push(`  ${edge.from} -->|${edge.outcome}| ${edge.to}`)
  }
  return `${lines.join('\n')}\n`
}

export function syncCanvas(projectRoot = process.cwd()) {
  const root = resolve(projectRoot)
  const workflow = parseWorkflow(readLoop(root))
  const outputPath = resolve(root, 'canvas', 'loop.mmd')
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, mermaidFromWorkflow(workflow), 'utf8')
  return { path: outputPath }
}

function nodeFileTemplates(nodeId, title) {
  return {
    'AGENTS.md': `---\naudience: [agent]\nkind: directive\n---\n\n# ${title} Rules\n\n- Stay inside this node's declared scope.\n- Read NODE.md, CONTRACT.md, SYSTEM.md, and GATE.md before acting.\n- Produce only the artifacts declared by CONTRACT.md.\n`,
    'NODE.md': `# ${title}\n\n## Purpose\n\nDescribe what this node accomplishes.\n\n## Enter When\n\n- Define the routing condition that enters this node.\n\n## Steps\n\n1. Read this node's local harness files.\n2. Execute the node task.\n3. Produce declared artifacts.\n4. Evaluate GATE.md.\n\n## Exit\n\nRoute according to GATE.md outcomes.\n`,
    'SYSTEM.md': `# ${title} System Prompt\n\nYou are operating inside node \`${nodeId}\`.\nFollow the node contract and do not infer workflow behavior outside this node.\n`,
    'CONTRACT.md': `# ${title} Contract\n\n## Inputs\n\n- Define required inputs.\n\n## Outputs\n\n- Define required outputs.\n\n## Artifacts\n\n- Define artifact paths relative to the run node workspace.\n\n## Dependencies\n\n- Define required skills, plugins, agents, or environment variables.\n`,
    'GATE.md': `# ${title} Gate\n\n## Outcomes\n\n- pass\n- pause\n- fail\n\n## Pass\n\nDefine evidence required to continue.\n\n## Pause\n\nDefine when human input is required.\n\n## Fail\n\nDefine unrecoverable or invalid states.\n`,
  }
}

export function scaffoldNode(projectRoot = process.cwd(), nodeId, title = nodeId) {
  if (!nodeId) throw new Error('node id is required')
  const root = resolve(projectRoot)
  const folder = resolve(root, 'modules', nodeId)
  if (existsSync(folder)) throw new Error(`node already exists: ${nodeId}`)
  mkdirSync(folder, { recursive: true })

  const created = []
  for (const [file, body] of Object.entries(nodeFileTemplates(nodeId, title))) {
    const path = join(folder, file)
    writeFileSync(path, body, 'utf8')
    created.push(path)
  }
  return { nodeId, folder, created }
}

export function isDirectRun(importMetaUrl, argv = process.argv) {
  return argv[1] && importMetaUrl === pathToFileURL(argv[1]).href
}
