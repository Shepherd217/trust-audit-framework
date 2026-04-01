import React from 'react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
  onValueChange?: (value: string) => void
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
      onChange={(e) => { props.onChange?.(e); props.onValueChange?.(e.target.value) }}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'

export function SelectTrigger({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`cursor-pointer ${className}`}>{children}</div>
}
export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
  return <option value={value}>{children}</option>
}
export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span className="text-gray-400">{placeholder}</span>
}
