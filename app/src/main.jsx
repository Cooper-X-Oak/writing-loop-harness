import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { Bot, CircleStop, FileText, Play, RefreshCw, Send, ShieldCheck, UserRound } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import './styles.css'

const TERMINAL_PURPOSE = {
  HUMAN: '需要人类补充高影响决策，然后回到 active node。',
  END: '配置足够进入下一阶段，或初始化终止。',
}

const OUTCOME_COLOR = {
  pass: '#86d67b',
  pause: '#79b8df',
  fail: '#e17368',
}

const STATUS_LABEL = {
  idle: 'idle',
  current: 'current',
  pass: 'pass',
  pause: 'pause',
  fail: 'fail',
  completed: 'done',
  paused: 'paused',
  failed: 'failed',
  running: 'running',
}

function HarnessNode({ data, selected }) {
  return (
    <div className={`flow-node harness-node status-${data.status || 'idle'} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-topline">
        <div className="node-kicker">NODE</div>
        <span className="status-pill">{STATUS_LABEL[data.status || 'idle']}</span>
      </div>
      <div className="node-title">{data.label}</div>
      <div className="node-copy">{data.purpose}</div>
      <div className="node-meta">
        <ShieldCheck size={14} />
        <span>{data.gate}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function TerminalNode({ data, selected }) {
  const Icon = data.id === 'HUMAN' ? UserRound : CircleStop
  return (
    <div className={`flow-node terminal-node status-${data.status || 'idle'} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="terminal-head">
        <Icon size={16} />
        <span>TERMINAL</span>
        <span className="status-pill">{STATUS_LABEL[data.status || 'idle']}</span>
      </div>
      <div className="node-title">{data.label}</div>
      <div className="node-copy">{data.purpose}</div>
    </div>
  )
}

function nodeStatus(nodeId, run) {
  if (!run) return 'idle'
  if (run.currentNode === nodeId && run.status === 'running') return 'current'
  return run.nodes?.[nodeId]?.status || 'idle'
}

function terminalStatus(nodeId, run) {
  const last = run?.history?.[run.history.length - 1]
  if (!last || last.next !== nodeId) return 'idle'
  if (nodeId === 'HUMAN') return 'pause'
  return last.outcome || run.status || 'idle'
}

function edgeWasTraversed(edge, run) {
  return Boolean(run?.history?.some(item => (
    item.node === edge.from &&
    item.outcome === edge.outcome &&
    item.next === edge.to
  )))
}

function buildFlow(data, run) {
  const declaredNodes = data.graph.nodes
  const terminalIds = [...new Set(data.graph.edges
    .map(edge => edge.to)
    .filter(id => !declaredNodes.some(node => node.id === id)))]
  const columns = 4
  const columnGap = 260
  const rowGap = 220
  const origin = { x: 80, y: 190 }
  const terminalX = origin.x + columns * columnGap + 60

  const nodes = [
    ...declaredNodes.map((node, index) => ({
      id: node.id,
      type: 'harness',
      position: {
        x: origin.x + (index % columns) * columnGap,
        y: origin.y + Math.floor(index / columns) * rowGap,
      },
      data: {
        id: node.id,
        label: node.id,
        purpose: node.purpose,
        gate: node.gate,
        status: nodeStatus(node.id, run),
      },
    })),
    ...terminalIds.map((id, index) => ({
      id,
      type: 'terminal',
      position: { x: terminalX, y: origin.y + index * rowGap },
      data: {
        id,
        label: id,
        purpose: TERMINAL_PURPOSE[id] || 'Terminal route target.',
        status: terminalStatus(id, run),
      },
    })),
  ]

  const pairSeen = new Map()
  const edges = data.graph.edges.map(edge => {
    const key = `${edge.from}->${edge.to}`
    const seen = pairSeen.get(key) || 0
    pairSeen.set(key, seen + 1)
    const traversed = edgeWasTraversed(edge, run)
    return {
      id: `${edge.from}-${edge.outcome}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.outcome,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: OUTCOME_COLOR[edge.outcome] || '#86d67b' },
      style: {
        stroke: OUTCOME_COLOR[edge.outcome] || '#86d67b',
        strokeWidth: traversed ? 4 : 2,
        opacity: traversed ? 1 : 0.42,
      },
      labelStyle: {
        fill: '#dfe8dc',
        fontSize: 12,
        fontWeight: 700,
      },
      labelBgStyle: {
        fill: '#161a17',
        stroke: '#3c443a',
        strokeWidth: 1,
      },
      pathOptions: {
        offset: seen * 24,
      },
      data: edge,
      className: traversed ? 'edge-traversed' : '',
    }
  })

  return { nodes, edges }
}

function RunStatusBar({ run, events, onRefresh, busy }) {
  const history = run?.history || []
  const latest = history[history.length - 1]
  const recentEvents = events.slice(-4)

  return (
    <div className="run-status">
      <div className="run-summary">
        <span className={`run-dot status-${run?.status || 'idle'}`} />
        <div>
          <p>Run State</p>
          <strong>{run?.runId || 'no run yet'}</strong>
          <span>{run ? `${STATUS_LABEL[run.status] || run.status} · ${run.currentNode || latest?.next || 'no active node'}` : 'start a run to see workflow feedback'}</span>
        </div>
      </div>
      <div className="run-history">
        {history.length === 0 ? (
          <span className="history-empty">No routed steps</span>
        ) : history.slice(-4).map((item, index) => (
          <span className={`route-chip outcome-${item.outcome}`} key={`${item.node}-${item.at}-${index}`}>
            {item.node} / {item.outcome} {'->'} {item.next}
          </span>
        ))}
      </div>
      <div className="event-stream">
        {recentEvents.length === 0 ? (
          <span className="history-empty">No events</span>
        ) : recentEvents.map((event, index) => (
          <span className="event-chip" key={`${event.type}-${event.at}-${index}`}>
            {event.type}
          </span>
        ))}
      </div>
      <button className="refresh-run" type="button" onClick={onRefresh} disabled={busy}>
        <RefreshCw size={14} />
        Refresh
      </button>
    </div>
  )
}

function CodexPanel() {
  const [messages, setMessages] = useState([
    { role: 'agent', text: '本面板通过本机 codex exec 回答问题。Windows read-only sandbox 在本机不可用，所以 bridge 以可用优先运行，并在提示词中强约束只读不改文件。' },
  ])
  const [prompt, setPrompt] = useState('解释当前 loop 的 active node 和 gate 路由')
  const [busy, setBusy] = useState(false)

  const send = useCallback(async () => {
    const text = prompt.trim()
    if (!text || busy) return
    setPrompt('')
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', text }])
    try {
      const response = await fetch('/api/codex/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      })
      const data = await response.json()
      const output = data.stdout || data.stderr || data.error || `Codex exited with ${data.code}`
      setMessages(prev => [...prev, { role: 'agent', text: output.trim() }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'agent', text: error.message }])
    } finally {
      setBusy(false)
    }
  }, [busy, prompt])

  return (
    <aside className="codex-panel">
      <div className="panel-head">
        <p>Local Agent</p>
        <h2><Bot size={18} /> Codex CLI</h2>
        <span>local bridge · codex exec</span>
      </div>
      <div className="chat-log">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
            <strong>{message.role === 'user' ? 'Human' : 'Codex'}</strong>
            <pre>{message.text}</pre>
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send()
          }}
          placeholder="问 Codex 当前 harness、节点、gate 或下一步..."
        />
        <button onClick={send} disabled={busy || !prompt.trim()} type="button">
          <Send size={16} />
          {busy ? 'Running' : 'Send'}
        </button>
      </div>
    </aside>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [run, setRun] = useState(null)
  const [events, setEvents] = useState([])
  const [runBusy, setRunBusy] = useState(false)

  useEffect(() => {
    fetch('/workflow-data.json')
      .then(response => response.json())
      .then(nextData => setData(nextData))
  }, [])

  const refreshRun = useCallback(async () => {
    setRunBusy(true)
    try {
      const response = await fetch('/api/runs/latest')
      const result = await response.json()
      setRun(result.run || null)
      setEvents(result.events || [])
    } finally {
      setRunBusy(false)
    }
  }, [])

  useEffect(() => {
    refreshRun()
    const timer = window.setInterval(refreshRun, 3000)
    return () => window.clearInterval(timer)
  }, [refreshRun])

  const nodeTypes = useMemo(() => ({ harness: HarnessNode, terminal: TerminalNode }), [])
  const flow = useMemo(() => data ? buildFlow(data, run) : { nodes: [], edges: [] }, [data, run])
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    setNodes(flow.nodes)
    setEdges(flow.edges)
  }, [flow, setEdges, setNodes])

  if (!data) return <div className="loading">Loading workflow...</div>

  return (
    <main className="shell">
      <section className="canvas-wrap">
        <div className="canvas-toolbar">
          <div>
            <p>Graph View</p>
            <h2>Agent workflow loop</h2>
          </div>
          <div className="toolbar-actions">
            <a href="/file/LOOP.md" target="_blank" rel="noreferrer"><FileText size={15} /> LOOP.md</a>
            <a href="/file/AGENTS.md" target="_blank" rel="noreferrer"><Play size={15} /> Root rules</a>
          </div>
        </div>
        <RunStatusBar run={run} events={events} onRefresh={refreshRun} busy={runBusy} />
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#3b4239" gap={32} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </section>

      <CodexPanel />
    </main>
  )
}

createRoot(document.querySelector('#root')).render(<App />)
