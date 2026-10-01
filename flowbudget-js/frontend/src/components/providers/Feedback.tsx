'use client';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar } from '@mui/material';
import { useTranslations } from 'next-intl';
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';

type Severity = 'success' | 'error' | 'info' | 'warning';

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  destructive?: boolean;
}

interface FeedbackContext {
  notify: (message: string, severity?: Severity) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const Context = createContext<FeedbackContext | null>(null);

export function useFeedback(): FeedbackContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const [queue, setQueue] = useState<{ id: number; message: string; severity: Severity }[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(value: boolean) => void>(undefined);

  const notify = useCallback((message: string, severity: Severity = 'success') => {
    setQueue((q) => [...q, { id: Date.now() + Math.random(), message, severity }]);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    setDialog(null);
  };

  const current = queue[0];
  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <Context.Provider value={{ notify, confirm }}>
      {children}
      <Snackbar
        key={current?.id}
        open={!!current}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && dismiss()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity={current?.severity} variant="filled" onClose={dismiss} sx={{ width: '100%' }}>
          {current?.message}
        </Alert>
      </Snackbar>
      <Dialog open={!!dialog} onClose={() => close(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog?.title}</DialogTitle>
        {dialog?.description && (
          <DialogContent>
            {typeof dialog.description === 'string' ? <DialogContentText>{dialog.description}</DialogContentText> : dialog.description}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => close(false)}>{t('cancel')}</Button>
          <Button variant="contained" color={dialog?.destructive === false ? 'primary' : 'error'} onClick={() => close(true)}>
            {dialog?.confirmText ?? t('proceed')}
          </Button>
        </DialogActions>
      </Dialog>
    </Context.Provider>
  );
}
