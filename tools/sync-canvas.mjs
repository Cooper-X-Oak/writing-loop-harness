import { isDirectRun, syncCanvas } from './loop-lib.mjs'

export { syncCanvas }

if (isDirectRun(import.meta.url)) {
  const root = process.argv[2] || process.cwd()
  const result = syncCanvas(root)
  process.stdout.write(`synced ${result.path}\n`)
}
