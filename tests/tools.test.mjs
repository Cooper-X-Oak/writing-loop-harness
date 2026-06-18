import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const validateUrl = new URL('../tools/validate-loop.mjs', import.meta.url)
const syncCanvasUrl = new URL('../tools/sync-canvas.mjs', import.meta.url)
const scaffoldUrl = new URL('../tools/scaffold-node.mjs', import.meta.url)
const exportUrl = new URL('../tools/export-workflow.mjs', import.meta.url)

function makeHarnessRoot() {
  return mkdtempSync(join(tmpdir(), 'workflow-harness-'))
}

async function writeValidHarness(root) {
  await mkdir(join(root, 'modules', '00_intake'), { recursive: true })
  await mkdir(join(root, 'skills'), { recursive: true })
  await mkdir(join(root, 'plugins'), { recursive: true })
  await mkdir(join(root, 'agents'), { recursive: true })
  await mkdir(join(root, 'canvas'), { recursive: true })

  writeFileSync(join(root, 'LOOP.md'), `# LOOP.md

## Node Index

| Node | Folder | Purpose | Gate |
|---|---|---|---|
| 00_intake | \`modules/00_intake/\` | Capture requirements | \`modules/00_intake/GATE.md\` |

## Edge Index

| From | Outcome | To | Meaning |
|---|---|---|---|
| 00_intake | pass | 00_intake | Continue refining |
| 00_intake | pause | HUMAN | Wait for human input |
| 00_intake | fail | HUMAN | Stop for human repair |
`, 'utf8')

  for (const file of ['AGENTS.md', 'NODE.md', 'SYSTEM.md', 'CONTRACT.md']) {
    writeFileSync(join(root, 'modules', '00_intake', file), `${file}\n`, 'utf8')
  }
  writeFileSync(join(root, 'modules', '00_intake', 'GATE.md'), `# Gate

## Outcomes

- pass
- pause
- fail
`, 'utf8')
  writeFileSync(join(root, 'skills', 'registry.md'), '# Skills\n', 'utf8')
  writeFileSync(join(root, 'plugins', 'registry.md'), '# Plugins\n', 'utf8')
  writeFileSync(join(root, 'agents', 'registry.md'), '# Agents\n', 'utf8')
}

test('validateLoop accepts a harness whose LOOP index matches module files and gate outcomes', async () => {
  const { validateLoop } = await import(validateUrl)
  const root = makeHarnessRoot()
  await writeValidHarness(root)

  const result = validateLoop(root)

  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
})

test('validateLoop reports missing node files and routes to unknown nodes', async () => {
  const { validateLoop } = await import(validateUrl)
  const root = makeHarnessRoot()
  await writeValidHarness(root)
  await rm(join(root, 'modules', '00_intake', 'SYSTEM.md'))
  writeFileSync(join(root, 'LOOP.md'), readFileSync(join(root, 'LOOP.md'), 'utf8') +
    '| 00_intake | fail | missing_node | Bad route |\n', 'utf8')

  const result = validateLoop(root)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /missing node file: modules\/00_intake\/SYSTEM\.md/)
  assert.match(result.errors.join('\n'), /edge targets unknown node: missing_node/)
})

test('syncCanvas writes Mermaid from LOOP node and edge indexes', async () => {
  const { syncCanvas } = await import(syncCanvasUrl)
  const root = makeHarnessRoot()
  await writeValidHarness(root)

  const result = syncCanvas(root)
  const mermaid = readFileSync(join(root, 'canvas', 'loop.mmd'), 'utf8')

  assert.equal(result.path.endsWith(join('canvas', 'loop.mmd')), true)
  assert.match(mermaid, /flowchart TD/)
  assert.ok(mermaid.includes('00_intake["00_intake'))
  assert.match(mermaid, /00_intake -->\|pass\| 00_intake/)
  assert.match(mermaid, /00_intake -->\|pause\| HUMAN/)
  assert.equal(mermaid.match(/HUMAN\["HUMAN"\]/g).length, 1)
})

test('scaffoldNode creates the standard node harness files without overwriting existing nodes', async () => {
  const { scaffoldNode } = await import(scaffoldUrl)
  const root = makeHarnessRoot()

  const result = scaffoldNode(root, '10_topic_gate', 'Topic Gate')

  assert.equal(result.created.length, 5)
  for (const file of ['AGENTS.md', 'NODE.md', 'SYSTEM.md', 'CONTRACT.md', 'GATE.md']) {
    assert.ok(existsSync(join(root, 'modules', '10_topic_gate', file)))
  }
  assert.throws(() => scaffoldNode(root, '10_topic_gate', 'Topic Gate'), /node already exists/)
})

test('exportWorkflowData returns graph, module file metadata, and registries for the frontend', async () => {
  const { exportWorkflowData } = await import(exportUrl)
  const root = makeHarnessRoot()
  await writeValidHarness(root)

  const data = exportWorkflowData(root)

  assert.equal(data.graph.nodes[0].id, '00_intake')
  assert.equal(data.graph.edges.length, 3)
  assert.equal(data.modules[0].files.length, 5)
  assert.ok(data.modules[0].files.some(file => file.name === 'GATE.md' && file.path === 'modules/00_intake/GATE.md'))
  assert.deepEqual(data.registries.map(item => item.path), [
    'skills/registry.md',
    'plugins/registry.md',
    'agents/registry.md',
  ])
})
