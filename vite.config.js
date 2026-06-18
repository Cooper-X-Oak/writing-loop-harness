import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { createReadStream, existsSync } from 'node:fs'
import { normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { writeWorkflowData } from './tools/export-workflow.mjs'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function readJsonBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = ''
    request.on('data', chunk => {
      body += chunk
      if (body.length > 32_000) reject(new Error('request too large'))
    })
    request.on('end', () => {
      try {
        resolveBody(body ? JSON.parse(body) : {})
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(`${JSON.stringify(data, null, 2)}\n`)
}

function runCodex(prompt) {
  return new Promise(resolveRun => {
    const child = spawn('codex', [
      'exec',
      '--cd',
      projectRoot,
      '--sandbox',
      process.env.CODEX_BRIDGE_SANDBOX || 'danger-full-access',
      '--color',
      'never',
      '-',
    ], {
      cwd: projectRoot,
      shell: true,
      windowsHide: true,
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => resolveRun({ code, stdout, stderr }))
    child.stdin.end(prompt)
  })
}

function workflowHarnessPlugin() {
  return {
    name: 'workflow-harness-local-bridge',
    configureServer(server) {
      writeWorkflowData(projectRoot)

      server.middlewares.use('/file', (request, response) => {
        const rawPath = decodeURIComponent((request.url || '').replace(/^\//, ''))
        const requested = normalize(rawPath)
        const filePath = resolve(projectRoot, requested)
        if (!filePath.startsWith(projectRoot)) {
          response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
          response.end('forbidden')
          return
        }
        if (!existsSync(filePath)) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          response.end('not found')
          return
        }
        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
        createReadStream(filePath).pipe(response)
      })

      server.middlewares.use('/api/codex/message', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'method not allowed' })
          return
        }
        try {
          const body = await readJsonBody(request)
          const prompt = String(body.prompt || '').trim()
          if (!prompt) {
            sendJson(response, 400, { error: 'prompt is required' })
            return
          }
          const result = await runCodex([
            '你在 writing-loop-harness 仓库中作为只读 Codex CLI Agent 回复右侧面板的问题。',
            '不要修改文件，不要运行会写入仓库的命令。先读取 LOOP.md 和相关 modules 文件后再回答。',
            '',
            prompt,
          ].join('\n'))
          sendJson(response, 200, result)
        } catch (error) {
          sendJson(response, 500, { error: error.message })
        }
      })
    },
  }
}

export default defineConfig({
  root: 'app',
  plugins: [react(), workflowHarnessPlugin()],
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: false,
  },
})
