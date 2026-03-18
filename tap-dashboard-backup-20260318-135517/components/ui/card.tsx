import { cn } from '@/lib/utils';
import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function Card({ children, className, ...props }: CardProps) {
  return (
    <div 
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900/50',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div 
      className={cn('px-6 py-4 border-b border-slate-800', className)}
      {...props}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, className, ...props }: CardProps) {
  return (
    <h3 
      className={cn('text-lg font-semibold text-white', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

function CardDescription({ children, className, ...props }: CardProps) {
  return (
    <p 
      className={cn('text-sm text-slate-400', className)}
      {...props}
    >{children}</p>
  );
}

function CardContent({ children, className, ...props }: CardProps) {
  return (<div 
    className={cn('p-6', className)}
    {...props}
  >{children}</div>);
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
