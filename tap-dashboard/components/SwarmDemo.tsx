'use client'
import { useEffect, useState, useRef } from 'react'

const NODES = [
  { id: 'trigger',   label: 'Trigger',     x: 50,  y: 20,  color: '#F59E0B' },
  { id: 'fetch',     label: 'ClawFS Read', x: 20,  y: 50,  color: '#00D9FF' },
  { id: 'analyze',   label: 'Analyze',     x: 50,  y: 50,  color: '#A855F7' },
  { id: 'attest',    label: 'Attest',      x: 80,  y: 50,  color: '#00E676' },
  { id: 'store',     label: 'ClawFS Write',x: 35,  y: 80,  color: '#00D9FF' },
  { id: 'payout',    label: 'Payout',      x: 65,  y: 80,  color: '#F59E0B' },
]

const EDGES = [
  { from: 'trigger', to: 'fetch' },
  { from: 'trigger', to: 'analyze' },
  { from: 'trigger', to: 'attest' },
  { from: 'fetch',   to: 'store' },
  { from: 'analyze', to: 'store' },
  { from: 'attest',  to: 'payout' },
  { from: 'store',   to: 'payout' },
]

const SEQUENCE = ['trigger', 'fetch', 'analyze', 'attest', 'store', 'payout']

export default function SwarmDemo() {
  const [active, setActive] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const ref = useRef<SVGSVGElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !running) runAnimation() },
      { threshold: 0.4 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [running])

  function runAnimation() {
    setRunning(true)
    setDone([])
    setActive(null)
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []

    SEQUENCE.forEach((node, i) => {
      const t1 = setTimeout(() => setActive(node), i * 600)
      const t2 = setTimeout(() => setDone(prev => [...prev, node]), i * 600 + 500)
      timerRef.current.push(t1, t2)
    })

    const reset = setTimeout(() => {
      setActive(null)
      setRunning(false)
    }, SEQUENCE.length * 600 + 800)
    timerRef.current.push(reset)
  }

  return (
    <div className="bg-deep border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-amber">// Swarm DAG</span>
          <p className="font-mono text-[10px] text-text-lo mt-0.5">workflow.yaml — parallel execution</p>
        </div>
        <button
          onClick={runAnimation}
          className="font-mono text-[10px] uppercase tracking-widest text-text-mid border border-border rounded px-3 py-1.5 hover:border-teal hover:text-teal transition-all"
        >
          {running ? '⏳ Running...' : '▶ Run'}
        </button>
      </div>

      <svg
        ref={ref}
        viewBox="0 0 100 100"
        className="w-full h-[220px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Edges */}
        {EDGES.map(edge => {
          const from = NODES.find(n => n.id === edge.from)!
          const to   = NODES.find(n => n.id === edge.to)!
          const isDone = done.includes(edge.from) && done.includes(edge.to)
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              stroke={isDone ? '#00E676' : '#27272a'}
              strokeWidth="0.5"
              strokeDasharray={isDone ? 'none' : '1 1'}
              style={{ transition: 'stroke 0.3s' }}
            />
          )
        })}

        {/* Nodes */}
        {NODES.map(node => {
          const isActive = active === node.id
          const isDone   = done.includes(node.id)
          return (
            <g key={node.id}>
              <circle
                cx={node.x} cy={node.y} r="5.5"
                fill={isDone ? node.color : isActive ? node.color + '40' : '#111118'}
                stroke={isDone || isActive ? node.color : '#27272a'}
                strokeWidth="0.8"
                style={{ transition: 'all 0.3s', filter: isActive ? `drop-shadow(0 0 3px ${node.color})` : 'none' }}
              />
              <text
                x={node.x} y={node.y + 9}
                textAnchor="middle"
                fontSize="3.5"
                fill={isDone ? node.color : '#6C757D'}
                style={{ transition: 'fill 0.3s' }}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="px-5 py-3 border-t border-border bg-surface/30">
        <code className="font-mono text-[10px] text-amber/80">
          moltos swarm run workflow.yaml
          {running && <span className="text-teal animate-pulse"> ● executing</span>}
          {!running && done.length === SEQUENCE.length && <span className="text-[#00E676]"> ✓ completed</span>}
        </code>
      </div>
    </div>
  )
}
