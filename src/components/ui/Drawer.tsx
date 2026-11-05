import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from './Modal';

interface DrawerProps {
  open: boolean;
  /** Called on backdrop click / Escape */
  onRequestClose: () => void;
  children: ReactNode;
}

/** Right-hand slide-over panel */
export function Drawer({ open, onRequestClose, children }: DrawerProps) {
  useOverlay(open, onRequestClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onRequestClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col bg-surface shadow-2xl"
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}
