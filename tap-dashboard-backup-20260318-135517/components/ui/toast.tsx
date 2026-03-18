'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Toast icons
const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: 'bg-neon-green/10 border-neon-green/30 text-neon-green',
  error: 'bg-error/10 border-error/30 text-error',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  info: 'bg-cyan-blue/10 border-cyan-blue/30 text-cyan-blue',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId();
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        dismissToast(id);
      }, toast.duration || 5000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-24 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = toastIcons[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`p-4 rounded-xl border backdrop-blur-md shadow-lg ${toastStyles[toast.type]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white">{toast.title}</p>
          {toast.message && (
            <p className="text-sm text-white/70 mt-1">{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>
    </motion.div>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience hooks for specific toast types
export function useShowToast() {
  const { showToast } = useToast();
  
  return {
    success: (title: string, message?: string) => 
      showToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => 
      showToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) => 
      showToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) => 
      showToast({ type: 'info', title, message }),
  };
}
