'use client';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { ExpenditureDetailsDialog } from '@/components/expenses/ExpenditureDialogs';
import { api, query } from '@/lib/api';
import { DATE_FORMAT } from '@/lib/dates';
import { useFormat } from '@/lib/format';
import { useCategories, usePlans } from '@/lib/queries';
import type { Expenditure, Paged } from '@/lib/types';
import { useSelectedAccount } from '@/lib/use-selected-account';

type Preset = 'last30' | 'lastQuarter' | 'yearToDate' | 'allTime';
const PAGE_SIZE = 10;

const PRESET_LABELS: Record<Preset, string> = {
  last30: 'expenses_last_30_days',
  lastQuarter: 'expenses_last_quarter',
  yearToDate: 'expenses_year_to_date',
  allTime: 'expenses_all_time',
};

function presetFrom(preset: Preset): string | undefined {
  const today = dayjs();
  if (preset === 'last30') return today.subtract(30, 'day').format(DATE_FORMAT);
  if (preset === 'lastQuarter') return today.subtract(3, 'month').format(DATE_FORMAT);
  if (preset === 'yearToDate') return today.startOf('year').format(DATE_FORMAT);
  return undefined;
}

export default function ExpensesPage() {
  const t = useTranslations();
  const format = useFormat();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const { accounts, account, select, isLoading } = useSelectedAccount();
  const categories = useCategories();
  const plans = usePlans(account?.id);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [preset, setPreset] = useState<Preset>('last30');
  const [pocketFilter, setPocketFilter] = useState<{ accountId?: string; name: string | null }>({ name: null });
  const [pageState, setPageState] = useState({ filters: '', page: 1 });
  const [details, setDetails] = useState<Expenditure | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Filters are per account, and any filter change starts again from the first page.
  const pocketName = pocketFilter.accountId === account?.id ? pocketFilter.name : null;
  const setPocketName = (name: string | null) => setPocketFilter({ accountId: account?.id, name });
  const filters = JSON.stringify([account?.id, debouncedSearch, categoryId, preset, pocketName]);
  const page = pageState.filters === filters ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ filters, page: next });

  const pocketNames = useMemo(() => [...new Set((plans.data ?? []).flatMap((p) => p.pockets.map((pocket) => pocket.name)))], [plans.data]);

  const params = {
    accountId: account?.id,
    search: debouncedSearch,
    categoryId,
    pocketName,
    from: presetFrom(preset),
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useQuery({
    queryKey: ['day', 'expenditures', params],
    queryFn: () => api.get<Paged<Expenditure>>(`expenditures${query(params)}`),
    enabled: !!account,
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({
    queryKey: ['day', 'stats', account?.id],
    queryFn: () => api.get<{ monthly: number; weekly: number }>(`expenditures/stats${query({ accountId: account?.id })}`),
    enabled: !!account,
  });

  if (isLoading) return <Loading />;
  if (!account) return <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />;

  const total = list.data?.total ?? 0;
  const items = list.data?.items ?? [];
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <Box>
      <PageHeader
        title={t('expenses_page_title')}
        actions={
          <Button component={NextLink} href="/export" variant="outlined" startIcon={<FileDownloadIcon />}>
            {t('export_data_button')}
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {(['monthly', 'weekly'] as const).map((key) => (
          <Grid key={key} size={{ xs: 6, md: 3 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>
              <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 700 }}>
                {t(key === 'monthly' ? 'expenses_monthly_spend' : 'expenses_weekly_spend')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {stats.data ? format.money(stats.data[key], account.currencyCode) : '—'}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <AccountSelect accounts={accounts} value={account.id} onChange={select} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('expenses_search_placeholder')}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              select
              size="small"
              label={t('category')}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <MenuItem value="">{t('all_categories')}</MenuItem>
              {(categories.data ?? []).map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {format.category(c)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              select
              size="small"
              label={t('date')}
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
            >
              {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                <MenuItem key={p} value={p}>
                  {t(PRESET_LABELS[p])}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {[null, ...pocketNames].map((name) => (
                <Chip
                  key={name ?? 'all'}
                  label={name ?? t('all')}
                  color={pocketName === name ? 'primary' : 'default'}
                  variant={pocketName === name ? 'filled' : 'outlined'}
                  onClick={() => setPocketName(name)}
                />
              ))}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        {list.isFetching && <LinearProgress />}
        {list.isLoading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {t('no_expenditures_found')}
          </Typography>
        ) : mobile ? (
          <Stack spacing={1} sx={{ p: 1 }}>
            {items.map((e) => (
              <Card key={e.id}>
                <CardActionArea onClick={() => setDetails(e)}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{e.name}</Typography>
                      <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>-{format.money(e.price, e.currency)}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {format.date(e.date)} · {e.pocketName} · {format.category(e.category)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell>{t('date')}</TableCell>
                  <TableCell>{t('category')}</TableCell>
                  <TableCell>{t('name')}</TableCell>
                  <TableCell>{t('description')}</TableCell>
                  <TableCell>{t('pocket')}</TableCell>
                  <TableCell align="right">{t('amount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id} hover onClick={() => setDetails(e)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{format.date(e.date)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={format.category(e.category)} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{e.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 260 }}>
                      <Typography variant="body2" noWrap>
                        {e.description || t('no_description')}
                      </Typography>
                    </TableCell>
                    <TableCell>{e.pocketName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      -{format.money(e.price, e.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1, p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption">{t('expenses_pagination_summary', { from, to, total })}</Typography>
          <Pagination count={Math.max(1, Math.ceil(total / PAGE_SIZE))} page={page} onChange={(_, p) => setPage(p)} color="primary" size={mobile ? 'small' : 'medium'} />
        </Box>
      </Paper>

      {details && <ExpenditureDetailsDialog expenditure={details} onClose={() => setDetails(null)} />}
    </Box>
  );
}
