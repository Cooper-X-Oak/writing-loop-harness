import { isDirectRun, scaffoldNode } from './loop-lib.mjs'

export { scaffoldNode }

if (isDirectRun(import.meta.url)) {
  const [, , nodeId, ...titleParts] = process.argv
  const result = scaffoldNode(process.cwd(), nodeId, titleParts.join(' ') || nodeId)
  process.stdout.write(`created ${result.nodeId} at ${result.folder}\n`)
}
