import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Modale (feuille du bas sur mobile, boîte centrée sur grand écran)
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-night-850 shadow-2xl outline-none sm:rounded-3xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/15 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-silver-400 hover:bg-white/5 hover:text-white" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-white/5 px-5 pt-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Notifications éphémères (toasts)
// ---------------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur',
              t.kind === 'success' && 'border-emerald-500/30 bg-night-850/95 text-emerald-200',
              t.kind === 'error' && 'border-alert-500/40 bg-night-850/95 text-alert-400',
              t.kind === 'info' && 'border-electric-500/30 bg-night-850/95 text-silver-100',
            )}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : t.kind === 'error' ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <p className="flex-1">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  return {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  };
}

// ---------------------------------------------------------------------------
// Confirmation avec motif facultatif / obligatoire
// ---------------------------------------------------------------------------
export function useConfirmState<T = undefined>() {
  const [state, setState] = useState<{ open: boolean; payload?: T }>({ open: false });
  return {
    open: state.open,
    payload: state.payload,
    show: (payload?: T) => setState({ open: true, payload }),
    hide: () => setState({ open: false }),
  };
}
