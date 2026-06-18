import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { writeWorkflowData } from './export-workflow.mjs'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

function sendFile(response, filePath) {
  if (!existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('not found')
    return
  }
  response.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'text/plain; charset=utf-8' })
  createReadStream(filePath).pipe(response)
}

export function serveApp(projectRoot = process.cwd(), port = 4173) {
  writeWorkflowData(projectRoot)
  const appRoot = resolve(projectRoot, 'app')
  const root = resolve(projectRoot)
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname.startsWith('/file/')) {
      const requested = normalize(decodeURIComponent(url.pathname.slice('/file/'.length)))
      const filePath = resolve(root, requested)
      if (!filePath.startsWith(root)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('forbidden')
        return
      }
      sendFile(response, filePath)
      return
    }
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname
    sendFile(response, join(appRoot, pathname))
  })
  server.listen(port, '127.0.0.1')
  return server
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const port = Number(process.env.PORT || 4173)
  serveApp(process.cwd(), port)
  process.stdout.write(`workflow canvas running at http://127.0.0.1:${port}/\n`)
}
