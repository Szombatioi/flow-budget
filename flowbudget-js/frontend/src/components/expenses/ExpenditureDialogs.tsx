'use client';

import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import { Box, Button, DialogActions, DialogContent, DialogTitle, Divider, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { type FormEvent, Fragment, useState } from 'react';
import { useFormat } from '@/lib/format';
import type { Category, Expenditure } from '@/lib/types';
import { ResponsiveDialog } from '../common/ResponsiveDialog';

export function ExpenditureDetailsDialog({ expenditure, onClose }: { expenditure: Expenditure; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const rows: [string, React.ReactNode][] = [
    [t('name'), expenditure.name],
    [t('amount'), format.money(expenditure.price, expenditure.currency)],
    [t('date'), format.date(expenditure.date)],
    [t('pocket'), expenditure.pocketName],
    [t('category'), format.category(expenditure.category)],
    [t('description'), expenditure.description || t('no_description')],
  ];
  if (expenditure.wishlistId) {
    rows.push([
      t('wishlist'),
      <Box key="w" component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <CardGiftcardIcon fontSize="small" /> {expenditure.wishlistName}
      </Box>,
    ]);
  }

  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <DialogTitle>{t('expenditure_details')}</DialogTitle>
      <DialogContent>
        {rows.map(([label, value], i) => (
          <Fragment key={label}>
            {i > 0 && <Divider />}
            <Box sx={{ py: 1.25 }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography sx={{ wordBreak: 'break-word' }}>{value}</Typography>
            </Box>
          </Fragment>
        ))}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          {t('close')}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}

export interface ExpenditureUpdate {
  name: string;
  price: number;
  description: string | null;
  categoryId: string | null;
}

export function EditExpenditureDialog({
  expenditure,
  categories,
  saving,
  onClose,
  onSave,
}: {
  expenditure: Expenditure;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSave: (update: ExpenditureUpdate) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const [name, setName] = useState(expenditure.name);
  const [price, setPrice] = useState(String(expenditure.price));
  const [description, setDescription] = useState(expenditure.description ?? '');
  const [categoryId, setCategoryId] = useState(expenditure.category?.id ?? '');
  const value = Number(price);
  const valid = name.trim().length > 0 && value > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSave({ name: name.trim(), price: Math.round(value * 100) / 100, description: description.trim() || null, categoryId: categoryId || null });
  };

  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{t('edit_expenditure')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField
              label={t('amount')}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 0.01, step: '0.01' }, input: { endAdornment: <InputAdornment position="end">{format.currencySymbol(expenditure.currency)}</InputAdornment> } }}
            />
            <TextField select label={t('category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <MenuItem value="">{t('chart_uncategorized')}</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {format.category(c)}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={t('description')} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!valid || saving}>
            {t('save')}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
