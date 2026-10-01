'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { useFeedback } from '@/components/providers/Feedback';
import { api, query } from '@/lib/api';
import { DATE_FORMAT, todayStr } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import { keys, useEffectivePlan } from '@/lib/queries';
import type { DayOption, WishlistMode } from '@/lib/types';
import { useSelectedAccount } from '@/lib/use-selected-account';

export default function NewWishlistPage() {
  const t = useTranslations();
  const format = useFormat();
  const router = useRouter();
  const qc = useQueryClient();
  const { notify } = useFeedback();
  const errorMessage = useErrorMessage();
  const { accounts, account, select, isLoading } = useSelectedAccount();
  const plan = useEffectivePlan(account?.id, todayStr());

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState<Dayjs | null>(dayjs().add(3, 'month'));
  const [mode, setMode] = useState<WishlistMode>('manual');
  const [from, setFrom] = useState<Dayjs | null>(dayjs());
  const [to, setTo] = useState<Dayjs | null>(dayjs().endOf('month'));
  const [chosenPocketId, setPocketId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const pockets = useMemo(() => plan.data?.pockets ?? [], [plan.data]);
  const pocketId = pockets.some((p) => p.id === chosenPocketId) ? chosenPocketId : (pockets[0]?.id ?? '');

  const rangeValid = !!from?.isValid() && !!to?.isValid() && !to.isBefore(from, 'day');
  const days = useQuery({
    queryKey: ['day', 'in-range', pocketId, from?.format(DATE_FORMAT), to?.format(DATE_FORMAT)],
    queryFn: () => api.get<DayOption[]>(`daily-expenses/${pocketId}/in-range${query({ from: from!.format(DATE_FORMAT), to: to!.format(DATE_FORMAT) })}`),
    enabled: mode === 'automatic' && !!pocketId && rangeValid,
  });
  const selectable = (days.data ?? []).filter((d) => !d.wishlistId && d.date >= todayStr());

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const amount = Number(target);
  const valid = !!account && name.trim().length > 0 && amount > 0 && !!targetDate?.isValid();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid || !account || !targetDate) {
      notify(t('field_required'), 'warning');
      return;
    }
    setSaving(true);
    try {
      await api.post('wishlists', {
        accountId: account.id,
        name: name.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        targetAmount: Math.round(amount * 100) / 100,
        targetDate: targetDate.format(DATE_FORMAT),
        mode,
        affectedDailyExpenseIds: mode === 'automatic' ? [...selected] : [],
      });
      notify(t('save_success'));
      qc.invalidateQueries({ queryKey: keys.wishlists });
      router.push('/wishlist');
    } catch (e) {
      notify(errorMessage(e, 'save_error'), 'error');
      setSaving(false);
    }
  };

  if (isLoading) return <Loading />;
  if (!account) return <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader title={t('create_new_wishlist')} />
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <AccountSelect
            accounts={accounts}
            value={account.id}
            onChange={(id) => {
              select(id);
              setSelected(new Set());
            }}
          />
          <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
          <TextField label={t('description')} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 2000 } }} />
          <TextField label={t('wishlist_image_url')} placeholder="https://" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('wishlist_target_goal')}
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              slotProps={{ htmlInput: { min: 0.01, step: '0.01' }, input: { endAdornment: <InputAdornment position="end">{format.currencySymbol(account.currencyCode)}</InputAdornment> } }}
            />
            <DatePicker label={t('wishlist_target_date')} value={targetDate} onChange={setTargetDate} disablePast slotProps={{ textField: { fullWidth: true, required: true } }} />
          </Stack>

          <Box>
            <FormLabel>{t('wishlist_select_mode')}</FormLabel>
            <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as WishlistMode)}>
              <FormControlLabel value="manual" control={<Radio />} label={t('wishlist_approach_manual')} />
              <FormControlLabel value="automatic" control={<Radio />} label={t('wishlist_approach_automatic')} />
            </RadioGroup>
            <Typography variant="body2" color="text.secondary">
              {t(mode === 'automatic' ? 'wishlist_mode_automatic_hint' : 'wishlist_mode_manual_hint')}
            </Typography>
          </Box>

          {mode === 'automatic' &&
            (pockets.length === 0 ? (
              <Alert severity="info">{t('no_plans_yet')}</Alert>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack spacing={2}>
                    <DatePicker label={t('from')} value={from} onChange={setFrom} disablePast slotProps={{ textField: { fullWidth: true } }} />
                    <DatePicker label={t('to')} value={to} onChange={setTo} minDate={from ?? undefined} slotProps={{ textField: { fullWidth: true } }} />
                    <TextField select label={t('pocket')} value={pocketId} onChange={(e) => {
                        setPocketId(e.target.value);
                        setSelected(new Set());
                      }}>
                      {pockets.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" fullWidth onClick={() => setSelected(new Set(selectable.map((d) => d.id)))}>
                        {t('select')}
                      </Button>
                      <Button variant="outlined" fullWidth onClick={() => setSelected(new Set())}>
                        {t('deselect')}
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, height: '100%', minHeight: 220, maxHeight: 360, overflow: 'auto' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {t('wishlist_affected_des')} ({selected.size})
                    </Typography>
                    {days.isLoading ? (
                      <CircularProgress size={24} />
                    ) : (days.data ?? []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {t('wishlist_affected_des_empty')}
                      </Typography>
                    ) : (
                      (days.data ?? []).map((d) => {
                        const disabled = !!d.wishlistId || d.date < todayStr();
                        return (
                          <FormControlLabel
                            key={d.id}
                            sx={{ display: 'flex' }}
                            disabled={disabled}
                            control={<Checkbox size="small" checked={selected.has(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />}
                            label={`${format.date(d.date)} (${d.pocketName})${d.wishlistId ? ` – ${t('wishlist_day_taken')}` : ''}`}
                          />
                        );
                      })
                    )}
                  </Paper>
                </Grid>
              </Grid>
            ))}

          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Button type="submit" variant="contained" size="large" disabled={saving} startIcon={saving ? <CircularProgress size={18} /> : undefined} sx={{ px: 6 }}>
              {t('create')}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
