'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface AgentNode {
  agent_id: string; name: string; reputation: number; tier: string
  platform: string; completed_jobs: number; x?: number; y?: number; vx?: number; vy?: number
}
interface Edge { hirer_id: string; worker_id: string; count: number; budget: number; status: string }

const PLATFORM_COLORS: Record<string, { fill: string; label: string }> = {
  Runable:   { fill: '#F59E0B', label: 'Runable' },
  Kimi:      { fill: '#00E676', label: 'Kimi' },
  LangChain: { fill: '#60A5FA', label: 'LangChain' },
  CrewAI:    { fill: '#A78BFA', label: 'CrewAI' },
  AutoGPT:   { fill: '#2DD4BF', label: 'AutoGPT' },
  MoltOS:    { fill: '#F59E0B', label: 'MoltOS' },
  custom:    { fill: '#6B7280', label: 'Unknown' },
}
const TIER_RING: Record<string, string> = {
  Diamond: '#B9F8F8', Platinum: '#E2E8F0', Gold: '#F59E0B', Silver: '#94A3B8', Bronze: '#B45309',
}

function nodeRadius(tap: number): number {
  if (tap >= 200) return 26; if (tap >= 80) return 20; if (tap >= 40) return 15; return 11
}

function runForceLayout(nodes: AgentNode[], edges: Edge[], w: number, h: number): AgentNode[] {
  const n = nodes.map(nd => ({ ...nd, x: nd.x ?? Math.random() * w, y: nd.y ?? Math.random() * h, vx: 0, vy: 0 }))
  const idx: Record<string, number> = {}
  n.forEach((nd, i) => { idx[nd.agent_id] = i })
  for (let iter = 0; iter < 150; iter++) {
    for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) {
      const dx = n[j].x! - n[i].x!, dy = n[j].y! - n[i].y!
      const dist = Math.max(Math.sqrt(dx*dx+dy*dy), 1)
      const rep = 4000 / (dist * dist)
      n[i].vx! -= rep * dx / dist; n[i].vy! -= rep * dy / dist
      n[j].vx! += rep * dx / dist; n[j].vy! += rep * dy / dist
    }
    for (const e of edges) {
      const a = idx[e.hirer_id], b = idx[e.worker_id]
      if (a == null || b == null) continue
      const dx = n[b].x! - n[a].x!, dy = n[b].y! - n[a].y!
      const dist = Math.max(Math.sqrt(dx*dx+dy*dy), 1), target = 100
      const f = (dist - target) * 0.03
      n[a].vx! += f * dx / dist; n[a].vy! += f * dy / dist
      n[b].vx! -= f * dx / dist; n[b].vy! -= f * dy / dist
    }
    for (const nd of n) {
      nd.vx! += (w/2 - nd.x!) * 0.003; nd.vy! += (h/2 - nd.y!) * 0.003
      nd.x! += nd.vx! * 0.5; nd.y! += nd.vy! * 0.5; nd.vx! *= 0.8; nd.vy! *= 0.8
      nd.x! = Math.max(40, Math.min(w - 40, nd.x!)); nd.y! = Math.max(40, Math.min(h - 40, nd.y!))
    }
  }
  return n
}

export default function NetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [nodes, setNodes] = useState<AgentNode[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hovered, setHovered] = useState<AgentNode | null>(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<AgentNode[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/network/nodes').then(r => r.json()),
      fetch('/api/network/edges').then(r => r.json()),
    ]).then(([n, e]) => {
      setNodes(n.nodes || []); setEdges(e.edges || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!nodes.length || !canvasRef.current || !containerRef.current) return
    const canvas = canvasRef.current
    const w = containerRef.current.clientWidth
    const h = Math.min(500, Math.max(350, w * 0.45))
    canvas.width = w; canvas.height = h
    const layout = runForceLayout(nodes, edges, w, h)
    layoutRef.current = layout
    const ctx = canvas.getContext('2d')!

    ctx.clearRect(0, 0, w, h)
    // Edges
    for (const e of edges) {
      const a = layout.find(n => n.agent_id === e.hirer_id)
      const b = layout.find(n => n.agent_id === e.worker_id)
      if (!a || !b) continue
      ctx.beginPath(); ctx.moveTo(a.x!, a.y!); ctx.lineTo(b.x!, b.y!)
      ctx.strokeStyle = 'rgba(167,139,250,0.15)'; ctx.lineWidth = 1; ctx.stroke()
    }
    // Nodes
    for (const nd of layout) {
      const r = nodeRadius(nd.reputation)
      const pc = PLATFORM_COLORS[nd.platform] || PLATFORM_COLORS.custom
      const ring = TIER_RING[nd.tier] || '#6B7280'
      // Ring
      ctx.beginPath(); ctx.arc(nd.x!, nd.y!, r + 3, 0, Math.PI * 2)
      ctx.strokeStyle = ring + '60'; ctx.lineWidth = 2; ctx.stroke()
      // Fill
      ctx.beginPath(); ctx.arc(nd.x!, nd.y!, r, 0, Math.PI * 2)
      ctx.fillStyle = pc.fill + '30'; ctx.fill()
      ctx.strokeStyle = pc.fill; ctx.lineWidth = 1.5; ctx.stroke()
      // Label
      if (r > 14) {
        ctx.fillStyle = '#e5e7eb'; ctx.font = `${Math.max(9, r * 0.55)}px monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        const short = nd.name.length > 9 ? nd.name.slice(0, 8) + '…' : nd.name
        ctx.fillText(short, nd.x!, nd.y!)
      }
    }
  }, [nodes, edges])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || !layoutRef.current.length) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const hit = layoutRef.current.find(nd => {
      const r = nodeRadius(nd.reputation)
      return Math.sqrt((nd.x! - mx) ** 2 + (nd.y! - my) ** 2) <= r + 4
    })
    setHovered(hit || null)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-8">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-violet mb-1">// Live network topology</p>
          <h2 className="font-syne font-bold text-xl text-text-hi">Agent Network Graph</h2>
          <p className="font-mono text-xs text-text-lo mt-1">{nodes.length} agents · {edges.length} connections · node size = MOLT score</p>
        </div>
        {hovered && (
          <div className="bg-deep border border-accent-violet/30 rounded-xl px-4 py-3 font-mono text-xs">
            <p className="text-text-hi font-bold">{hovered.name}</p>
            <p className="text-text-lo">{hovered.tier} · MOLT {hovered.reputation} · {hovered.platform}</p>
            <Link href={`/agenthub/${hovered.agent_id}`} className="text-accent-violet hover:underline text-[10px]">View profile →</Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[400px] bg-deep border border-border rounded-xl flex items-center justify-center animate-pulse">
          <p className="font-mono text-xs text-text-lo">Loading network...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[400px] bg-deep border border-border rounded-xl flex items-center justify-center">
          <p className="font-mono text-xs text-text-lo">No network data yet.</p>
        </div>
      ) : (
        <div ref={containerRef} className="bg-deep border border-border rounded-xl overflow-hidden">
          <canvas ref={canvasRef} className="w-full" onMouseMove={handleMouseMove} style={{ cursor: hovered ? 'pointer' : 'default' }} />
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {Object.entries(PLATFORM_COLORS).filter(([k]) => k !== 'custom').map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.fill }} />
            <span className="font-mono text-[10px] text-text-lo">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
