'use client';

import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Autocomplete,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ResponsiveDialog } from '@/components/common/ResponsiveDialog';
import { Loading, PageHeader } from '@/components/common/States';
import { useFeedback } from '@/components/providers/Feedback';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/format';
import { keys, useAccounts, useCurrencies } from '@/lib/queries';
import type { Account, Currency } from '@/lib/types';

export default function AccountsPage() {
  const t = useTranslations();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();
  const accounts = useAccounts();
  const currencies = useCurrencies();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.accounts });
    qc.invalidateQueries({ queryKey: keys.user });
  };

  const create = useMutation({
    mutationFn: () => api.post('accounts', { name: name.trim(), currencyCode: currency!.code }),
    onSuccess: () => {
      notify(t('account_save_success'));
      setName('');
      setCurrency(null);
      setSubmitted(false);
      refresh();
    },
    onError: (e) => notify(errorMessage(e, 'error_save_account'), 'error'),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`accounts/${id}`, { name }),
    onSuccess: () => {
      notify(t('save_success'));
      setEditing(null);
      refresh();
    },
    onError: (e) => notify(errorMessage(e, 'save_error'), 'error'),
  });

  const remove = async (account: Account) => {
    if (!(await confirm({ title: t('delete_account_title'), description: t('delete_account_confirm_description') }))) return;
    try {
      await api.delete(`accounts/${account.id}`);
      notify(t('item_deleted'));
      refresh();
    } catch (e) {
      notify(errorMessage(e, 'delete_error'), 'error');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !currency) return;
    create.mutate();
  };

  const currencyLabel = (c: Currency) => `${c.code} – ${t.has(c.name) ? t(c.name) : c.name}`;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <PageHeader title={t('financial_accounts')} />
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {t('create_account')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
          <TextField
            label={t('account_name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={submitted && !name.trim()}
            helperText={submitted && !name.trim() ? t('account_name_required') : undefined}
            slotProps={{ htmlInput: { maxLength: 50 } }}
          />
          <Autocomplete
            options={currencies.data ?? []}
            value={currency}
            onChange={(_, value) => setCurrency(value)}
            getOptionLabel={currencyLabel}
            isOptionEqualToValue={(a, b) => a.code === b.code}
            fullWidth
            renderInput={(params) => (
              <TextField {...params} label={t('currency')} error={submitted && !currency} helperText={submitted && !currency ? t('currency_required') : undefined} />
            )}
          />
          <Button type="submit" variant="contained" disabled={create.isPending} sx={{ height: 56, px: 4, flexShrink: 0 }}>
            {t('create')}
          </Button>
        </Stack>
      </Paper>

      <Paper>
        {accounts.isLoading ? (
          <Loading />
        ) : !accounts.data?.length ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {t('no_accounts')}
          </Typography>
        ) : (
          <List disablePadding>
            {accounts.data.map((account, i) => (
              <ListItem
                key={account.id}
                divider={i < accounts.data.length - 1}
                secondaryAction={
                  <>
                    <IconButton aria-label={t('edit_account')} onClick={() => setEditing(account)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label={t('delete')} color="error" onClick={() => remove(account)}>
                      <DeleteIcon />
                    </IconButton>
                  </>
                }
              >
                <ListItemText primary={account.name} secondary={`${t('currency')}: ${account.currencyCode}`} />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {editing && (
        <RenameDialog
          account={editing}
          saving={rename.isPending}
          onClose={() => setEditing(null)}
          onSave={(newName) => rename.mutate({ id: editing.id, name: newName })}
        />
      )}
    </Box>
  );
}

function RenameDialog({ account, saving, onClose, onSave }: { account: Account; saving: boolean; onClose: () => void; onSave: (name: string) => void }) {
  const t = useTranslations();
  const [name, setName] = useState(account.name);
  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <DialogTitle>{t('edit_account')}</DialogTitle>
        <DialogContent>
          <TextField autoFocus label={t('account_name')} value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 50 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || saving}>
            {t('save')}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}
