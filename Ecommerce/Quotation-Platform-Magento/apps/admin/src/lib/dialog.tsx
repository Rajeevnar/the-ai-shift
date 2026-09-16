'use client';

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

// Replaces window.confirm/alert/prompt with a styled, centered modal that
// matches the rest of the app instead of the browser's native dialog — an
// explicit ask, not just cosmetic: native dialogs also block the whole tab
// (including in-flight fetches' UI updates) in a way that reads as the app
// having frozen.
//
// Each method returns a Promise so call sites read almost identically to
// the native versions: `if (await confirmDialog('Delete this?')) { ... }`.

type ConfirmOptions = { confirmLabel?: string; cancelLabel?: string; danger?: boolean };

interface DialogState {
  kind: 'confirm' | 'alert' | 'prompt';
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  defaultValue: string;
  resolve: (value: boolean | string | null) => void;
}

interface DialogContextValue {
  confirmDialog: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alertDialog: (message: string) => Promise<void>;
  promptDialog: (message: string, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((value: boolean | string | null) => void) | null>(null);

  const open = useCallback((next: Omit<DialogState, 'resolve'>) => {
    return new Promise<boolean | string | null>((resolve) => {
      resolveRef.current = resolve;
      setInputValue(next.defaultValue);
      setState({ ...next, resolve });
    });
  }, []);

  const confirmDialog = useCallback(
    (message: string, options?: ConfirmOptions) =>
      open({
        kind: 'confirm',
        message,
        confirmLabel: options?.confirmLabel ?? 'Confirm',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        danger: options?.danger ?? false,
        defaultValue: '',
      }) as Promise<boolean>,
    [open],
  );

  const alertDialog = useCallback(
    (message: string) =>
      open({ kind: 'alert', message, confirmLabel: 'OK', cancelLabel: '', danger: false, defaultValue: '' }).then(
        () => undefined,
      ),
    [open],
  );

  const promptDialog = useCallback(
    (message: string, defaultValue = '') =>
      open({
        kind: 'prompt',
        message,
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
        danger: false,
        defaultValue,
      }) as Promise<string | null>,
    [open],
  );

  function close(value: boolean | string | null) {
    resolveRef.current?.(value);
    setState(null);
  }

  return (
    <DialogContext.Provider value={{ confirmDialog, alertDialog, promptDialog }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <p className="mb-4 whitespace-pre-line text-sm text-slate-700">{state.message}</p>
            {state.kind === 'prompt' && (
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && close(inputValue)}
                className="mb-4 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            )}
            <div className="flex justify-end gap-2">
              {state.kind !== 'alert' && (
                <button
                  type="button"
                  onClick={() => close(state.kind === 'prompt' ? null : false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  {state.cancelLabel}
                </button>
              )}
              <button
                type="button"
                autoFocus={state.kind !== 'prompt'}
                onClick={() => close(state.kind === 'prompt' ? inputValue : true)}
                className={`rounded px-3 py-1.5 text-sm font-medium text-white ${
                  state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
