'use client';

import AddIcon from '@mui/icons-material/Add';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { CategoryDonut } from '@/components/charts/Charts';
import { HeatmapCalendar } from '@/components/charts/HeatmapCalendar';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading } from '@/components/common/States';
import { AddExpenseDialog } from '@/components/expenses/AddExpenseDialog';
import { EditExpenditureDialog, ExpenditureDetailsDialog, type ExpenditureUpdate } from '@/components/expenses/ExpenditureDialogs';
import { useFeedback } from '@/components/providers/Feedback';
import { api, query } from '@/lib/api';
import { DATE_FORMAT, isValidDateStr, todayStr } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import { keys, useCategories, useEffectivePlan, useUser, useWishlists } from '@/lib/queries';
import type { DailyExpense, Expenditure } from '@/lib/types';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useSelectedAccount } from '@/lib/use-selected-account';

const POCKET_STORAGE_KEY = 'fb.dashboard.pocketLineage';

function Dashboard() {
  const t = useTranslations();
  const format = useFormat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();

  const requested = searchParams.get('date');
  const date = isValidDateStr(requested) ? requested : todayStr();
  const isPast = date < todayStr();

  const user = useUser();
  const { accounts, account, select, isLoading: accountsLoading } = useSelectedAccount();
  const plan = useEffectivePlan(account?.id, date);
  const categories = useCategories();
  const wishlists = useWishlists();

  // Pockets get a new id per version, so the selection is remembered by lineage.
  const [pocketLineage, selectPocket] = useLocalStorage(POCKET_STORAGE_KEY);
  const pockets = plan.data?.pockets ?? [];
  const pocket = pockets.find((p) => p.lineageId === pocketLineage) ?? pockets[0];

  const day = useQuery({
    queryKey: keys.day(pocket?.id ?? '', date),
    queryFn: () => api.get<DailyExpense>(`daily-expenses/${pocket!.id}${query({ date })}`),
    enabled: !!pocket,
  });

  const [adding, setAdding] = useState(false);
  const [details, setDetails] = useState<Expenditure | null>(null);
  const [editing, setEditing] = useState<Expenditure | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['day'] });
    qc.invalidateQueries({ queryKey: keys.wishlists });
  };

  const goTo = (target: string) => router.push(target === todayStr() ? '/' : `/?date=${target}`);
  const shift = (days: number) => goTo(dayjs(date).add(days, 'day').format(DATE_FORMAT));

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenditureUpdate }) => api.put(`expenditures/${id}`, data),
    onSuccess: () => {
      notify(t('save_success'));
      setEditing(null);
      refresh();
    },
    onError: (e) => notify(errorMessage(e, 'save_error'), 'error'),
  });

  const remove = async (expenditure: Expenditure) => {
    if (!(await confirm({ title: t('delete_expenditure_title'), description: t('delete_expenditure_confirm_description') }))) return;
    try {
      await api.delete(`expenditures/${expenditure.id}`);
      notify(t('item_deleted'));
      refresh();
    } catch (e) {
      notify(errorMessage(e, 'delete_error'), 'error');
    }
  };

  const accountWishlists = (wishlists.data ?? []).filter((w) => w.accountId === account?.id);
  const linkable = accountWishlists.filter((w) => w.mode === 'automatic' && w.status !== 'completed');
  const movable = accountWishlists.filter((w) => w.status === 'active');

  const changeLink = async (wishlistId: string) => {
    const current = day.data;
    if (!current || wishlistId === (current.wishlistId ?? '')) return;
    const target = linkable.find((w) => w.id === wishlistId);
    const ok = await confirm({
      title: target ? t('wishlist_link_confirm_title') : t('wishlist_unlink_confirm_title'),
      description: target ? t('wishlist_link_confirm_description', { name: target.name }) : t('wishlist_unlink_confirm_description'),
      destructive: false,
    });
    if (!ok) return;
    try {
      if (target) await api.post(`wishlists/${target.id}/align/${current.id}`);
      else await api.delete(`wishlists/align/${current.id}`);
      notify(t('save_success'));
      refresh();
    } catch (e) {
      notify(errorMessage(e, 'save_error'), 'error');
    }
  };

  if (accountsLoading || user.isLoading) return <Loading />;
  if (!account) return <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />;

  const toolbar = (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <AccountSelect accounts={accounts} value={account.id} onChange={select} showCurrency={false} />
        {pockets.length > 0 && (
          <TextField select size="small" label={t('select_pocket')} value={pocket?.lineageId ?? ''} onChange={(e) => selectPocket(e.target.value)} sx={{ minWidth: 180 }}>
            {pockets.map((p) => (
              <MenuItem key={p.lineageId} value={p.lineageId}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center' }}>
        <IconButton onClick={() => shift(-1)} aria-label={t('previous_day')}>
          <ChevronLeftIcon />
        </IconButton>
        <DatePicker
          value={dayjs(date)}
          onChange={(d) => d?.isValid() && goTo(d.format(DATE_FORMAT))}
          slotProps={{ textField: { size: 'small', sx: { width: 170 } } }}
          aria-label={t('date')}
        />
        <IconButton onClick={() => shift(1)} aria-label={t('next_day')}>
          <ChevronRightIcon />
        </IconButton>
        <Button onClick={() => goTo(todayStr())} disabled={date === todayStr()}>
          {t('today')}
        </Button>
      </Stack>
    </Stack>
  );

  if (plan.isLoading) {
    return (
      <>
        {toolbar}
        <Loading />
      </>
    );
  }
  if (!plan.data || !pocket) {
    return (
      <>
        {toolbar}
        <EmptyState message={t('no_plans_yet')} action={{ label: t('nav_planning_and_setup'), href: '/plan' }} />
      </>
    );
  }

  const data = day.data;
  const currency = account.currencyCode;
  const spent = data ? data.expenditures.reduce((acc, e) => acc + e.price, 0) : 0;
  const percent = data && data.startAmount > 0 ? (spent / data.startAmount) * 100 : spent > 0 ? 100 : 0;
  const gaugeColor = percent < 50 ? 'var(--mui-palette-success-main)' : percent < 80 ? 'var(--mui-palette-warning-main)' : 'var(--mui-palette-error-main)';

  return (
    <>
      {toolbar}
      <Typography variant="h5" component="h1" sx={{ mb: 2, textAlign: { xs: 'center', md: 'left' } }}>
        {format.longDate(date)}
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
              {day.isLoading ? (
                <Loading />
              ) : day.error || !data ? (
                <Alert severity="error">{errorMessage(day.error, 'error_load_daily_expense')}</Alert>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: 'center' }}>
                  <Box sx={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
                    <Gauge
                      width={220}
                      height={220}
                      value={Math.min(percent, 100)}
                      innerRadius="78%"
                      cornerRadius="50%"
                      text=""
                      sx={{ [`& .${gaugeClasses.valueArc}`]: { fill: gaugeColor, transition: 'all .6s ease' } }}
                    />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('todays_budget')}
                      </Typography>
                      <Typography variant="h4">{Math.round(percent)}%</Typography>
                      <Typography variant="caption">
                        {format.number(spent)} / {format.money(data.startAmount, currency)}
                      </Typography>
                    </Box>
                  </Box>
                  <Stack spacing={1.5} sx={{ flexGrow: 1, width: '100%' }}>
                    <Alert severity={data.eodAmount < 0 ? 'warning' : 'info'}>
                      <Typography>
                        {t('remaining_budget')}: <b>{format.money(data.eodAmount, currency)}</b>
                      </Typography>
                      <Typography variant="body2">
                        {t('relative_daily_limit')}: {format.money(data.relativeBudget, currency)}
                      </Typography>
                    </Alert>
                    {linkable.length > 0 && (
                      <TextField
                        select
                        size="small"
                        label={t('dashboard_link_to_wishlist')}
                        value={data.wishlistId ?? ''}
                        onChange={(e) => changeLink(e.target.value)}
                        disabled={isPast}
                        helperText={isPast ? t('wishlist_link_past_hint') : undefined}
                      >
                        <MenuItem value="">{t('wishlist_link_none')}</MenuItem>
                        {linkable.map((w) => (
                          <MenuItem key={w.id} value={w.id}>
                            {w.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  </Stack>
                </Stack>
              )}
            </Paper>

            <Paper sx={{ p: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, mb: 1 }}>
                <Typography variant="h6" component="h2">
                  {t('expenditures')}
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)} disabled={!data}>
                  {t('add')}
                </Button>
              </Box>
              {data && data.expenditures.length === 0 ? (
                <Typography color="text.secondary" sx={{ px: 1, py: 2 }}>
                  {t('no_expenditures_yet')}
                </Typography>
              ) : (
                <List disablePadding>
                  {data?.expenditures.map((e) => (
                    <ListItem
                      key={e.id}
                      disablePadding
                      divider
                      secondaryAction={
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                          <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', mr: 0.5 }}>{format.money(e.price, e.currency)}</Typography>
                          <IconButton size="small" aria-label={t('edit_expenditure')} onClick={() => setEditing(e)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" aria-label={t('delete')} onClick={() => remove(e)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <ListItemButton onClick={() => setDetails(e)} sx={{ pr: 22, borderRadius: 2 }}>
                        <ListItemText
                          primary={
                            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              {e.wishlistId && (
                                <Tooltip title={e.wishlistName ?? ''}>
                                  <Chip size="small" color="secondary" variant="outlined" icon={<CardGiftcardIcon />} label={t('wishlist_prefix')} />
                                </Tooltip>
                              )}
                              <span>{e.name}</span>
                            </Box>
                          }
                          secondary={format.category(e.category)}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2 }}>
              <HeatmapCalendar pocketId={pocket.id} date={dayjs(date)} selected={dayjs(date)} currency={currency} onSelect={(d) => goTo(d.format(DATE_FORMAT))} />
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                {t('chart_category_breakdown')}
              </Typography>
              <CategoryDonut pocketId={pocket.id} mode="daily" date={dayjs(date)} currency={currency} height={220} />
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {adding && (
        <AddExpenseDialog
          date={date}
          currency={currency}
          pockets={pockets}
          defaultPocketId={pocket.id}
          categories={categories.data ?? []}
          wishlists={movable}
          hasApiKey={user.data?.hasApiKey ?? false}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      {details && <ExpenditureDetailsDialog expenditure={details} onClose={() => setDetails(null)} />}
      {editing && (
        <EditExpenditureDialog
          expenditure={editing}
          categories={categories.data ?? []}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(data) => update.mutate({ id: editing.id, data })}
        />
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}
