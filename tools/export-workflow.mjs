import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { exportWorkflowData, isDirectRun } from './loop-lib.mjs'

export { exportWorkflowData }

export function writeWorkflowData(projectRoot = process.cwd(), outputPath = 'app/workflow-data.json') {
  const resolvedOutput = resolve(projectRoot, outputPath)
  mkdirSync(dirname(resolvedOutput), { recursive: true })
  const data = exportWorkflowData(projectRoot)
  writeFileSync(resolvedOutput, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return { path: resolvedOutput, data }
}

if (isDirectRun(import.meta.url)) {
  const root = process.argv[2] || process.cwd()
  const output = process.argv[3] || 'app/workflow-data.json'
  const result = writeWorkflowData(root, output)
  process.stdout.write(`exported ${result.data.graph.nodes.length} nodes to ${result.path}\n`)
}
