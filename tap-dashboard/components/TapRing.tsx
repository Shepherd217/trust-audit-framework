'use client'
import { useEffect, useState } from 'react'
import { TIER_CONFIG, type Tier } from '@/lib/types'

interface Props {
  score: number
  tier: Tier
  size?: number
  strokeWidth?: number
  showLabel?: boolean
}

export default function TapRing({
  score,
  tier,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
}: Props) {
  const [animated, setAnimated] = useState(false)
  const cfg = TIER_CONFIG[tier]
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = animated ? circ * (1 - score / 100) : circ
  const cx = size / 2
  const cy = size / 2

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(26,45,69,0.8)"
          strokeWidth={strokeWidth}
        />
        {/* Glow */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={cfg.color}
          strokeWidth={strokeWidth + 4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          opacity={0.15}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={cfg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-syne font-black leading-none"
            style={{
              fontSize: size * 0.25,
              color: cfg.color,
            }}
          >
            {score}
          </span>
          <span
            className="font-mono uppercase tracking-widest"
            style={{ fontSize: size * 0.085, color: 'rgba(122,154,184,0.8)' }}
          >
            TAP
          </span>
        </div>
      )}
    </div>
  )
}
