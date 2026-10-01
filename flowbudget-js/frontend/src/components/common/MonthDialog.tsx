'use client';

import { Button, DialogActions, DialogContent, DialogContentText, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { upcomingMonths } from '@/lib/dates';
import { useFormat } from '@/lib/format';
import { ResponsiveDialog } from './ResponsiveDialog';

export function MonthDialog({
  open,
  title,
  description,
  minMonth,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  minMonth?: string | null;
  onClose: () => void;
  onConfirm: (month: string) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const months = upcomingMonths(13).filter((m) => !minMonth || m >= minMonth);
  const [month, setMonth] = useState(months[0]);

  return (
    <ResponsiveDialog open={open} onClose={onClose} maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {description && <DialogContentText sx={{ mb: 2 }}>{description}</DialogContentText>}
        <TextField select label={t('month')} value={months.includes(month) ? month : months[0]} onChange={(e) => setMonth(e.target.value)} sx={{ mt: 1 }}>
          {months.map((m) => (
            <MenuItem key={m} value={m}>
              {format.month(m)}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" onClick={() => onConfirm(months.includes(month) ? month : months[0])}>
          {t('confirm')}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
