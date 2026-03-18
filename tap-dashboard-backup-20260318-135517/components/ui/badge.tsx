import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef, ReactNode } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'emerald' | 'cyan';
  children?: ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-800 text-slate-200',
      secondary: 'bg-slate-700 text-slate-200',
      outline: 'border border-slate-600 text-slate-200',
      emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      cyan: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
