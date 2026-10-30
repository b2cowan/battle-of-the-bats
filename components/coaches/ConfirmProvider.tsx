'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import KitDialog from '@/components/shared/KitDialog';

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

  // First call wins: guard the resolver so settling once clears the open question cleanly.
  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpts(null);
    resolve?.(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <KitDialog
          kind="question"
          title={opts.title ?? 'Please confirm'}
          onClose={() => settle(false)}
          openOn="panel"
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => settle(false)}>
                {opts.cancelText ?? 'Cancel'}
              </button>
              <button
                type="button"
                className={opts.tone === 'danger' ? 'btn btn-danger' : 'btn btn-lime'}
                onClick={() => settle(true)}
              >
                {opts.confirmText ?? 'Confirm'}
              </button>
            </>
          )}
        >
          <p>{opts.message}</p>
        </KitDialog>
      )}
    </ConfirmContext.Provider>
  );
}
