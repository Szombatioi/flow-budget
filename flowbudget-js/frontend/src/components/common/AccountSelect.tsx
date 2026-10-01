'use client';

import { MenuItem, TextField } from '@mui/material';
import { useTranslations } from 'next-intl';
import type { Account } from '@/lib/types';

export function AccountSelect({ accounts, value, onChange, showCurrency = true }: { accounts: Account[]; value?: string; onChange: (id: string) => void; showCurrency?: boolean }) {
  const t = useTranslations();
  return (
    <TextField select size="small" label={t('select_account')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: 200, maxWidth: { sm: 280 } }}>
      {accounts.map((a) => (
        <MenuItem key={a.id} value={a.id}>
          {a.name}
          {showCurrency && ` (${a.currencyCode})`}
        </MenuItem>
      ))}
    </TextField>
  );
}
