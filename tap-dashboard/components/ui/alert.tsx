import React from 'react'

interface AlertProps {
  children?: React.ReactNode
  className?: string
  variant?: 'default' | 'destructive'
}

export function Alert({ children, className = '', variant = 'default' }: AlertProps) {
  const colors = variant === 'destructive'
    ? 'border-red-500/50 bg-red-900/20 text-red-400'
    : 'border-gray-700 bg-gray-800 text-gray-300'
  return (
    <div className={`rounded-lg border p-4 ${colors} ${className}`}>
      {children}
    </div>
  )
}

export function AlertDescription({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`text-sm ${className}`}>{children}</div>
}

export function AlertTitle({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`font-semibold mb-1 ${className}`}>{children}</div>
}
