import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({ message })) ...` */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current(result);
    setOpts(null);
  }, []);

  const cancel = useCallback(() => close(false), [close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={cancel}
        size="sm"
        title={opts?.title ?? 'Confirmation'}
        icon={
          <span
            className={
              opts?.danger
                ? 'grid size-11 place-items-center rounded-2xl bg-red-50 text-red-600'
                : 'grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-500'
            }
          >
            {opts?.danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
          </span>
        }
        footer={
          <>
            <button className="btn-secondary" onClick={cancel}>
              Cancel
            </button>
            <button className={opts?.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} autoFocus>
              {opts?.confirmText ?? 'Yes'}
            </button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-slate-600">{opts?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}
