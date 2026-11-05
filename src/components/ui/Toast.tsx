import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

type ToastFn = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});

export const useToast = () => useContext(ToastContext);

const STYLES: Record<ToastType, { icon: typeof Info; box: string; icon_c: string; bar: string }> = {
  success: { icon: CheckCircle2, box: 'border-emerald-200', icon_c: 'text-emerald-600 bg-emerald-50', bar: 'bg-emerald-500' },
  error: { icon: XCircle, box: 'border-red-200', icon_c: 'text-red-600 bg-red-50', bar: 'bg-red-500' },
  warning: { icon: AlertTriangle, box: 'border-amber-200', icon_c: 'text-amber-600 bg-amber-50', bar: 'bg-amber-500' },
  info: { icon: Info, box: 'border-sky-200', icon_c: 'text-sky-600 bg-sky-50', bar: 'bg-sky-500' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastFn>(
    (message, type = 'success', duration = 3000) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2.5 px-4"
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              role="status"
              className={clsx(
                'pointer-events-auto relative flex w-full max-w-md animate-toast-in items-center gap-3 overflow-hidden rounded-2xl border bg-surface py-3 pr-2 pl-3 shadow-xl shadow-black/10',
                s.box,
              )}
            >
              <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl', s.icon_c)}>
                <Icon size={19} />
              </span>
              <p className="flex-1 text-sm font-medium text-slate-700">{t.message}</p>
              <button className="icon-btn size-8" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
              <span className={clsx('absolute bottom-0 left-0 h-0.5 w-full opacity-70', s.bar)} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
