import { isDirectRun, validateLoop } from './loop-lib.mjs'

export { validateLoop }

if (isDirectRun(import.meta.url)) {
  const root = process.argv[2] || process.cwd()
  const result = validateLoop(root)
  if (result.ok) {
    process.stdout.write(`loop valid: ${result.nodes.length} nodes, ${result.edges.length} edges\n`)
  } else {
    process.stderr.write(`${result.errors.join('\n')}\n`)
    process.exit(1)
  }
}
