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
import { Bot, CircleStop, FileText, Play, Send, ShieldCheck, UserRound } from 'lucide-react'
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

function HarnessNode({ data, selected }) {
  return (
    <div className={`flow-node harness-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-kicker">NODE</div>
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
    <div className={`flow-node terminal-node ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="terminal-head">
        <Icon size={16} />
        <span>TERMINAL</span>
      </div>
      <div className="node-title">{data.label}</div>
      <div className="node-copy">{data.purpose}</div>
    </div>
  )
}

function buildFlow(data) {
  const declaredNodes = data.graph.nodes
  const terminalEdges = data.graph.edges.filter(edge => !declaredNodes.some(node => node.id === edge.to))
  const terminalTargetCounts = terminalEdges.reduce((counts, edge) => {
    counts.set(edge.to, (counts.get(edge.to) || 0) + 1)
    return counts
  }, new Map())
  const terminalDisplayNodes = terminalEdges.map(edge => {
    const needsSplit = (terminalTargetCounts.get(edge.to) || 0) > 1
    return {
      id: needsSplit ? `${edge.to}_${edge.outcome}` : edge.to,
      actualId: edge.to,
      outcome: edge.outcome,
    }
  })

  const nodes = [
    ...declaredNodes.map((node, index) => ({
      id: node.id,
      type: 'harness',
      position: { x: 80 + index * 330, y: 220 },
      data: {
        id: node.id,
        label: node.id,
        purpose: node.purpose,
        gate: node.gate,
      },
    })),
    ...terminalDisplayNodes.map((terminal, index) => ({
      id: terminal.id,
      type: 'terminal',
      position: { x: 560, y: 100 + index * 230 },
      data: {
        id: terminal.actualId,
        label: terminal.id === terminal.actualId ? terminal.actualId : `${terminal.actualId} · ${terminal.outcome}`,
        purpose: TERMINAL_PURPOSE[terminal.actualId] || 'Terminal route target.',
      },
    })),
  ]

  const pairSeen = new Map()
  const edges = data.graph.edges.map(edge => {
    const key = `${edge.from}->${edge.to}`
    const seen = pairSeen.get(key) || 0
    pairSeen.set(key, seen + 1)
    return {
      id: `${edge.from}-${edge.outcome}-${edge.to}`,
      source: edge.from,
      target: (terminalTargetCounts.get(edge.to) || 0) > 1 ? `${edge.to}_${edge.outcome}` : edge.to,
      label: edge.outcome,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: OUTCOME_COLOR[edge.outcome] || '#86d67b' },
      style: {
        stroke: OUTCOME_COLOR[edge.outcome] || '#86d67b',
        strokeWidth: 2,
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
    }
  })

  return { nodes, edges }
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

  useEffect(() => {
    fetch('/workflow-data.json')
      .then(response => response.json())
      .then(nextData => setData(nextData))
  }, [])

  const nodeTypes = useMemo(() => ({ harness: HarnessNode, terminal: TerminalNode }), [])
  const flow = useMemo(() => data ? buildFlow(data) : { nodes: [], edges: [] }, [data])
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
