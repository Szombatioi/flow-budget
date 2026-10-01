'use client';

import { Box, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { ChartCard } from '@/components/charts/ChartCard';
import { Burndown, CategoryDonut, DailySpendingBar, PocketsLine } from '@/components/charts/Charts';
import { HeatmapCalendar } from '@/components/charts/HeatmapCalendar';
import { todayStr } from '@/lib/dates';
import { useEffectivePlan } from '@/lib/queries';
import { useSelectedAccount } from '@/lib/use-selected-account';

export default function StatisticsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { accounts, account, select, isLoading } = useSelectedAccount();
  const plan = useEffectivePlan(account?.id, todayStr());

  if (isLoading) return <Loading />;
  if (!account) return <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />;

  const pockets = plan.data?.pockets ?? [];
  const currency = account.currencyCode;

  return (
    <Box>
      <PageHeader title={t('nav_statistics')} actions={<AccountSelect accounts={accounts} value={account.id} onChange={select} />} />
      {plan.isLoading ? (
        <Loading />
      ) : !plan.data || pockets.length === 0 ? (
        <EmptyState message={t('no_plans_yet')} action={{ label: t('nav_planning_and_setup'), href: '/plan' }} />
      ) : (
        <Grid container spacing={2} key={plan.data.id}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title={t('diagram_title_bar')} pockets={pockets}>
              {({ pocket, mode, date }) => <DailySpendingBar pocketId={pocket?.id} mode={mode} date={date} currency={currency} />}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title={t('diagram_title_donut')} pockets={pockets} modes={['daily', 'weekly', 'monthly']}>
              {({ pocket, mode, date }) => <CategoryDonut pocketId={pocket?.id} mode={mode} date={date} currency={currency} />}
            </ChartCard>
          </Grid>
          <Grid size={12}>
            <ChartCard title={t('diagram_title_line')} pockets={pockets} showPocket={false}>
              {({ mode, date }) => <PocketsLine pockets={pockets} mode={mode} date={date} currency={currency} />}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title={t('diagram_title_burndown')} pockets={pockets}>
              {({ pocket, mode, date }) => <Burndown pocketId={pocket?.id} mode={mode} date={date} currency={currency} />}
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <ChartCard title={t('diagram_title_heatmap')} pockets={pockets} modes={['monthly']}>
              {({ pocket, date }) => (
                <HeatmapCalendar pocketId={pocket?.id} date={date} currency={currency} onSelect={(d) => router.push(`/?date=${d.format('YYYY-MM-DD')}`)} />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
