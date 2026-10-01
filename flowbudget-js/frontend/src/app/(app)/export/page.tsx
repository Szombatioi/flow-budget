'use client';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import DataObjectIcon from '@mui/icons-material/DataObject';
import GridOnIcon from '@mui/icons-material/GridOn';
import TableChartIcon from '@mui/icons-material/TableChart';
import { Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Grid, Paper, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { useFeedback } from '@/components/providers/Feedback';
import { download } from '@/lib/api';
import { DATE_FORMAT } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import { useCategories, usePlans } from '@/lib/queries';
import { useSelectedAccount } from '@/lib/use-selected-account';

type Format = 'TXT' | 'JSON' | 'CSV' | 'EXCEL';

const FORMATS: { id: Format; icon: ReactNode }[] = [
  { id: 'TXT', icon: <CodeIcon /> },
  { id: 'JSON', icon: <DataObjectIcon /> },
  { id: 'CSV', icon: <TableChartIcon /> },
  { id: 'EXCEL', icon: <GridOnIcon /> },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function ExportPage() {
  const t = useTranslations();
  const formatter = useFormat();
  const { notify } = useFeedback();
  const errorMessage = useErrorMessage();
  const { accounts, account, select, isLoading } = useSelectedAccount();
  const categories = useCategories();
  const plans = usePlans(account?.id);

  const pockets = useMemo(() => {
    const seen = new Set<string>();
    return (plans.data ?? []).flatMap((p) => p.pockets).filter((p) => !seen.has(p.lineageId) && seen.add(p.lineageId));
  }, [plans.data]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [excludedPockets, setExcludedPockets] = useState<string[]>([]);
  const [from, setFrom] = useState<Dayjs | null>(dayjs().subtract(30, 'day'));
  const [to, setTo] = useState<Dayjs | null>(dayjs());
  const [format, setFormat] = useState<Format | null>(null);
  const [separator, setSeparator] = useState('');
  const [exporting, setExporting] = useState(false);

  const selectedPockets = pockets.filter((p) => !excludedPockets.includes(p.lineageId)).map((p) => p.id);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const preset = (kind: 'last30' | 'quarter' | 'lastYear') => {
    const today = dayjs();
    if (kind === 'last30') {
      setFrom(today.subtract(30, 'day'));
      setTo(today);
    } else if (kind === 'quarter') {
      setFrom(today.month(Math.floor(today.month() / 3) * 3).startOf('month'));
      setTo(today);
    } else {
      setFrom(today.subtract(1, 'year').startOf('year'));
      setTo(today.subtract(1, 'year').endOf('year'));
    }
  };

  const rangeValid = !!from?.isValid() && !!to?.isValid() && !to.isBefore(from, 'day');

  const run = async () => {
    if (!account || !format || !rangeValid) return;
    if (selectedPockets.length === 0) {
      notify(t('select_at_least_one_pocket'), 'warning');
      return;
    }
    setExporting(true);
    try {
      await download(
        'expenditures/export',
        {
          accountId: account.id,
          format,
          from: from!.format(DATE_FORMAT),
          to: to!.format(DATE_FORMAT),
          categoryIds: selectedCategories,
          pocketIds: selectedPockets,
          separator: format === 'TXT' && separator ? separator : undefined,
        },
        `flowbudget-export.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`,
      );
      notify(t('export_started'));
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <Loading />;
  if (!account) return <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <PageHeader title={t('export_page_title')} subtitle={t('export_page_description')} />
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Stack spacing={3}>
          <Section title={t('account')}>
            <AccountSelect accounts={accounts} value={account.id} onChange={select} />
          </Section>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Section title={t('category')}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Chip label={t('all')} color={selectedCategories.length === 0 ? 'primary' : 'default'} variant={selectedCategories.length === 0 ? 'filled' : 'outlined'} onClick={() => setSelectedCategories([])} />
                  {(categories.data ?? []).map((c) => {
                    const on = selectedCategories.includes(c.id);
                    return <Chip key={c.id} label={formatter.category(c)} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={() => setSelectedCategories((l) => toggle(l, c.id))} />;
                  })}
                </Stack>
              </Section>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Section title={t('pocket')}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {pockets.map((p) => {
                    const on = !excludedPockets.includes(p.lineageId);
                    return <Chip key={p.id} label={p.name} color={on ? 'primary' : 'default'} variant={on ? 'filled' : 'outlined'} onClick={() => setExcludedPockets((l) => toggle(l, p.lineageId))} />;
                  })}
                </Stack>
              </Section>
            </Grid>
          </Grid>
          <Section title={t('date')}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <DatePicker label={t('from')} value={from} onChange={setFrom} maxDate={to ?? undefined} />
                <DatePicker label={t('to')} value={to} onChange={setTo} minDate={from ?? undefined} />
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small" onClick={() => preset('last30')}>
                  {t('expenses_last_30_days')}
                </Button>
                <Button variant="outlined" size="small" onClick={() => preset('quarter')}>
                  {t('export_this_quarter')}
                </Button>
                <Button variant="outlined" size="small" onClick={() => preset('lastYear')}>
                  {t('export_last_year')}
                </Button>
              </Stack>
            </Stack>
          </Section>
        </Stack>
      </Paper>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        {t('export_format')}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {FORMATS.map((f) => {
          const selected = format === f.id;
          return (
            <Grid key={f.id} size={{ xs: 6, md: 3 }}>
              <Card sx={{ height: '100%', borderWidth: 2, borderColor: selected ? 'primary.main' : 'divider' }}>
                <CardActionArea onClick={() => setFormat(f.id)} sx={{ height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', position: 'relative' }}>
                    {selected && <CheckCircleIcon color="success" fontSize="small" sx={{ position: 'absolute', top: 8, right: 8 }} />}
                    <Box sx={{ width: 52, height: 52, mx: 'auto', mb: 1, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {f.icon}
                    </Box>
                    <Typography variant="h6">{f.id}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`export_${f.id.toLowerCase()}_description`)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {format === 'TXT' && (
        <TextField
          label={t('separator')}
          placeholder="|"
          helperText={t('define_separator')}
          value={separator}
          onChange={(e) => setSeparator(e.target.value)}
          sx={{ maxWidth: 240, mb: 3 }}
          slotProps={{ htmlInput: { maxLength: 3 } }}
        />
      )}

      <Box sx={{ textAlign: 'center' }}>
        <Button variant="contained" size="large" onClick={run} disabled={!format || exporting || !rangeValid} startIcon={exporting ? <CircularProgress size={18} /> : undefined} sx={{ px: 6 }}>
          {t('export_data_button')}
        </Button>
      </Box>
    </Box>
  );
}
