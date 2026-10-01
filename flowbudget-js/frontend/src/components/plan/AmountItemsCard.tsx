'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import WalletIcon from '@mui/icons-material/Wallet';
import { Box, Button, Chip, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { upcomingMonths } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import { useAmountItems } from '@/lib/queries';
import type { Account, AmountItem } from '@/lib/types';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { Loading, SectionCard } from '../common/States';
import { useFeedback } from '../providers/Feedback';

type Kind = 'incomes' | 'fixed-expenses';

const TEXT = {
  incomes: {
    title: 'incomes_title',
    total: 'total_income',
    add: 'add_income',
    edit: 'edit_income',
    nameLabel: 'income_name_label',
    loadError: 'error_loading_incomes',
    deleteTitle: 'delete_income_title',
    deleteDescription: 'delete_income_confirm_description',
  },
  'fixed-expenses': {
    title: 'fixed_expenses_title',
    total: 'total_fixed_expenses',
    add: 'add_fixed_expense',
    edit: 'edit_fixed_expense',
    nameLabel: 'fixed_expense_name_label',
    loadError: 'error_loading_fixed_expenses',
    deleteTitle: 'delete_fixed_expense_title',
    deleteDescription: 'delete_fixed_expense_confirm_description',
  },
} as const;

export function AmountItemsCard({ kind, account }: { kind: Kind; account: Account }) {
  const t = useTranslations();
  const text = TEXT[kind];
  const format = useFormat();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();
  const items = useAmountItems(kind, account.id);
  const [dialog, setDialog] = useState<{ item?: AmountItem } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [kind, account.id] });
    qc.invalidateQueries({ queryKey: ['day'] });
  };

  const save = useMutation({
    mutationFn: async (input: { id?: string; name: string; amount: number; from: string }) => {
      if (input.id) await api.put(`${kind}/${input.id}`, { name: input.name, amount: input.amount, from: input.from });
      else await api.post(kind, { accountId: account.id, name: input.name, amount: input.amount });
    },
    onSuccess: () => {
      notify(t('save_success'));
      setDialog(null);
      invalidate();
    },
    onError: (e) => notify(errorMessage(e, 'save_error'), 'error'),
  });

  const remove = async (item: AmountItem) => {
    if (!(await confirm({ title: t(text.deleteTitle), description: t(text.deleteDescription) }))) return;
    try {
      await api.delete(`${kind}/${item.id}`);
      notify(t('item_deleted'));
      invalidate();
    } catch (e) {
      notify(errorMessage(e, 'delete_error'), 'error');
    }
  };

  const total = (items.data ?? []).reduce((acc, i) => acc + i.amount, 0);

  return (
    <SectionCard title={t(text.title)} icon={kind === 'incomes' ? <WalletIcon /> : <MoneyOffIcon />}>
      {items.isLoading ? (
        <Loading />
      ) : items.error ? (
        <Typography color="error">{t(text.loadError)}</Typography>
      ) : (
        <>
          <List disablePadding>
            {(items.data ?? []).map((item) => (
              <ListItem
                key={item.lineageId}
                divider
                sx={{ pr: 12 }}
                secondaryAction={
                  <>
                    <IconButton aria-label={t(text.edit)} onClick={() => setDialog({ item })}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label={t('delete')} color="error" onClick={() => remove(item)}>
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
              >
                <ListItemText
                  primary={item.name}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                      <span>{format.money(item.amount, account.currencyCode)}</span>
                      {item.upcoming && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="info"
                          label={
                            item.upcoming.isDeleted
                              ? t('upcoming_removal', { month: format.month(item.upcoming.activeFrom) })
                              : t('upcoming_change', { month: format.month(item.upcoming.activeFrom), value: format.money(item.upcoming.amount, account.currencyCode) })
                          }
                        />
                      )}
                    </Box>
                  }
                  slotProps={{ secondary: { component: 'div' } }}
                />
              </ListItem>
            ))}
          </List>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 2 }}>
            <Button startIcon={<AddIcon />} onClick={() => setDialog({})}>
              {t(text.add)}
            </Button>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                {t(text.total)}
              </Typography>
              <Typography variant="h6">{format.money(total, account.currencyCode)}</Typography>
            </Box>
          </Box>
        </>
      )}
      {dialog && (
        <AmountItemDialog
          title={t(dialog.item ? text.edit : text.add)}
          nameLabel={t(text.nameLabel)}
          item={dialog.item}
          currency={format.currencySymbol(account.currencyCode)}
          saving={save.isPending}
          onClose={() => setDialog(null)}
          onSave={(values) => save.mutate({ id: dialog.item?.id, ...values })}
        />
      )}
    </SectionCard>
  );
}

function AmountItemDialog({
  title,
  nameLabel,
  item,
  currency,
  saving,
  onClose,
  onSave,
}: {
  title: string;
  nameLabel: string;
  item?: AmountItem;
  currency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (values: { name: string; amount: number; from: string }) => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const months = upcomingMonths();
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [from, setFrom] = useState(months[0]);
  const value = Number(amount);
  const valid = name.trim().length > 0 && amount !== '' && Number.isFinite(value) && value >= 0;
  const amountChanged = item !== undefined && value !== item.amount;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSave({ name: name.trim(), amount: Math.round(value * 100) / 100, from });
  };

  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus label={nameLabel} value={name} onChange={(e) => setName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField
              label={t('amount')}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 0, step: '0.01' }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
            />
            {amountChanged && (
              <TextField select label={t('select_allow_from_title')} value={from} onChange={(e) => setFrom(e.target.value)} helperText={t('select_allow_from_description')}>
                {months.map((m) => (
                  <MenuItem key={m} value={m}>
                    {format.month(m)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!valid || saving}>
            {item ? t('save') : t('add')}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
