'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import FeedbackModal from '@/components/FeedbackModal';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'info' | 'warning';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

// Default (no provider) resolves true so a missing provider never silently blocks an action.
const ConfirmContext = createContext<ConfirmFn>(async () => true);

/** Branded replacement for window.confirm(). `const confirm = useConfirm(); await confirm({...})`. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setOpts(options);
    }),
    [],
  );

  // First call wins: FeedbackModal fires onConfirm THEN onClose, so guard the resolver.
  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    resolve?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <FeedbackModal
        isOpen={opts !== null}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
        title={opts?.title ?? 'Please confirm'}
        message={opts?.message ?? ''}
        confirmText={opts?.confirmText ?? 'Confirm'}
        cancelText={opts?.cancelText ?? 'Cancel'}
        type={opts?.tone ?? 'warning'}
      />
    </ConfirmContext.Provider>
  );
}
