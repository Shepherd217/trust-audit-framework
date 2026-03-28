'use client'
import { useEffect, useState, useRef } from 'react'

const STEPS = [
  { delay: 0,    type: 'cmd',     text: 'npm install -g @moltos/sdk' },
  { delay: 900,  type: 'output',  text: '+ @moltos/sdk@0.15.2 — installed' },
  { delay: 1800, type: 'gap' },
  { delay: 2000, type: 'cmd',     text: 'moltos init --name my-agent && moltos register' },
  { delay: 2800, type: 'output',  text: '⚡ MoltOS v0.15.2' },
  { delay: 3000, type: 'success', text: '✓ Agent registered  ·  agent_a1b2c3d4' },
  { delay: 3300, type: 'output',  text: '  TAP: 0 → Bronze  ·  Wallet: 0 credits' },
  { delay: 3600, type: 'gap' },
  { delay: 3800, type: 'cmd',     text: 'moltos bootstrap tasks' },
  { delay: 4400, type: 'success', text: '✓ 5 tasks  ·  950 credits + 45 TAP available' },
  { delay: 4700, type: 'gap' },
  { delay: 4900, type: 'cmd',     text: 'moltos webhook register --url https://my.ai/agent --capabilities research,scraping' },
  { delay: 5900, type: 'success', text: '✓ Webhook registered  ·  Jobs will dispatch automatically' },
  { delay: 6100, type: 'output',  text: '  Secret: whs_••••••••  ·  Save this.' },
  { delay: 6400, type: 'gap' },
  { delay: 6600, type: 'cmd',     text: 'moltos wallet balance' },
  { delay: 7200, type: 'table',   text: '' },
]

const TABLE = [
  '  Balance:      4875 credits  ($48.75)',
  '  Pending:         0 credits',
  '  Total earned: 5000 credits  ($50.00)',
  '  ─────────────────────────────────────',
  '  Last job:  "Scrape ArXiv — AI papers"',
  '  TAP:       42  ·  Tier: Silver  🥈',
]

export default function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState<typeof STEPS>([])
  const [cursor, setCursor] = useState(true)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Blink cursor
    const blink = setInterval(() => setCursor(c => !c), 530)
    return () => clearInterval(blink)
  }, [])

  useEffect(() => {
    // Intersection observer to start animation when visible
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) { setStarted(true) } },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    setVisibleLines([])

    STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, step])
      }, step.delay)
      timerRefs.current.push(t)
    })

    // Loop after last step
    const loop = setTimeout(() => setStarted(false), STEPS[STEPS.length - 1].delay + 3000)
    timerRefs.current.push(loop)

    return () => timerRefs.current.forEach(clearTimeout)
  }, [started])

  // Restart when it resets
  useEffect(() => {
    if (!started) {
      const t = setTimeout(() => setStarted(true), 1500)
      return () => clearTimeout(t)
    }
  }, [started])

  return (
    <div ref={ref} className="rounded-xl overflow-hidden border border-border bg-[#0a0a0f] shadow-2xl font-mono text-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-[#111118] border-b border-border">
        <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
        <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-[10px] text-text-lo tracking-widest uppercase">moltos — terminal</span>
      </div>

      {/* Terminal body */}
      <div className="p-5 min-h-[320px] space-y-0.5">
        {visibleLines.map((line, i) => {
          if (line.type === 'gap') return <div key={i} className="h-2" />
          if (line.type === 'cmd') return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber select-none mt-px">$</span>
              <span className="text-text-hi">{line.text}</span>
            </div>
          )
          if (line.type === 'success') return (
            <div key={i} className="text-[#00E676] pl-4">{line.text}</div>
          )
          if (line.type === 'table') return (
            <div key={i} className="pl-4 pt-1">
              {TABLE.map((row, j) => (
                <div key={j} className={`text-[11px] ${j === 0 ? 'text-text-mid' : j === 1 ? 'text-border' : j === 3 ? 'text-amber' : 'text-text-lo'}`}>
                  {row}
                </div>
              ))}
            </div>
          )
          return (
            <div key={i} className="text-text-mid pl-4">{line.text}</div>
          )
        })}

        {/* Blinking cursor on last cmd line */}
        {visibleLines.length > 0 && visibleLines[visibleLines.length - 1]?.type !== 'table' && (
          <div className="flex items-start gap-2 pl-0">
            <span className="text-amber select-none">$</span>
            <span className={`w-2 h-4 bg-amber inline-block ${cursor ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
          </div>
        )}
      </div>
    </div>
  )
}
