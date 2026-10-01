'use client';

import { Box, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import type { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useFormat } from '@/lib/format';
import type { Pocket } from '@/lib/types';
import { Loading } from '../common/States';
import { dayLabels, daysBetween, rangeFor, sumByDay, useBudgetSeries, useTimeSeries, useTimeSeriesForPockets, type ViewMode } from './data';

const HEIGHT = 300;
const Y_AXIS = [{ width: 72 }];

function NoData() {
  const t = useTranslations();
  return (
    <Box sx={{ height: HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography color="text.secondary">{t('chart_no_data')}</Typography>
    </Box>
  );
}

function Frame({ loading, empty, children }: { loading: boolean; empty: boolean; children: ReactNode }) {
  if (loading) return <Loading />;
  if (empty) return <NoData />;
  return <Box sx={{ width: '100%', minWidth: 0 }}>{children}</Box>;
}

interface PocketChartProps {
  pocketId?: string;
  mode: ViewMode;
  date: Dayjs;
  currency: string;
}

export function DailySpendingBar({ pocketId, mode, date, currency }: PocketChartProps) {
  const t = useTranslations();
  const format = useFormat();
  const [from, to] = rangeFor(mode === 'daily' ? 'weekly' : mode, date);
  const days = daysBetween(from, to);
  const series = useTimeSeries(pocketId, from, to);
  const data = sumByDay(series.data ?? [], days);

  return (
    <Frame loading={series.isLoading} empty={!series.data?.length}>
      <BarChart
        height={HEIGHT}
        yAxis={Y_AXIS}
        xAxis={[{ scaleType: 'band', data: dayLabels(mode === 'daily' ? 'weekly' : mode, days) }]}
        series={[{ data, label: t('chart_daily_spending'), valueFormatter: (v) => format.money(v ?? 0, currency) }]}
        hideLegend
      />
    </Frame>
  );
}

export function CategoryDonut({ pocketId, mode, date, currency, height = HEIGHT }: PocketChartProps & { height?: number }) {
  const format = useFormat();
  const [from, to] = rangeFor(mode, date);
  const series = useTimeSeries(pocketId, from, to);

  const totals = new Map<string, { label: string; value: number }>();
  for (const item of series.data ?? []) {
    const key = item.category?.id ?? 'none';
    const entry = totals.get(key) ?? { label: format.category(item.category), value: 0 };
    entry.value += item.price;
    totals.set(key, entry);
  }
  const data = [...totals.entries()].map(([id, v]) => ({ id, label: v.label, value: Math.round(v.value * 100) / 100 })).sort((a, b) => b.value - a.value);

  return (
    <Frame loading={series.isLoading} empty={data.length === 0}>
      <PieChart
        height={height}
        series={[{ data, innerRadius: '55%', paddingAngle: 2, cornerRadius: 4, valueFormatter: (v) => format.money(v.value, currency) }]}
        slotProps={{ legend: { direction: 'vertical', position: { vertical: 'middle', horizontal: 'end' } } }}
      />
    </Frame>
  );
}

export function PocketsLine({ pockets, mode, date, currency }: { pockets: Pocket[]; mode: ViewMode; date: Dayjs; currency: string }) {
  const format = useFormat();
  const [from, to] = rangeFor(mode === 'daily' ? 'weekly' : mode, date);
  const days = daysBetween(from, to);
  const results = useTimeSeriesForPockets(
    pockets.map((p) => p.id),
    from,
    to,
  );
  const loading = results.some((r) => r.isLoading);
  const series = pockets.map((p, i) => ({
    label: p.name,
    curve: 'linear' as const,
    data: sumByDay(results[i]?.data ?? [], days),
    valueFormatter: (v: number | null) => format.money(v ?? 0, currency),
  }));

  return (
    <Frame loading={loading} empty={series.every((s) => s.data.every((v) => v === 0))}>
      <LineChart height={HEIGHT} yAxis={Y_AXIS} xAxis={[{ scaleType: 'point', data: dayLabels(mode === 'daily' ? 'weekly' : mode, days) }]} series={series} />
    </Frame>
  );
}

export function Burndown({ pocketId, mode, date, currency }: PocketChartProps) {
  const t = useTranslations();
  const format = useFormat();
  const [from, to] = rangeFor(mode === 'daily' ? 'weekly' : mode, date);
  const days = daysBetween(from, to);
  const spending = useTimeSeries(pocketId, from, to);
  const budget = useBudgetSeries(pocketId, from, to);

  const spent = sumByDay(spending.data ?? [], days);
  const budgetByDay = new Map((budget.data ?? []).map((b) => [b.date, b.amount]));
  let expectedTotal = 0;
  let actualTotal = 0;
  const expected: number[] = [];
  const actual: number[] = [];
  days.forEach((d, i) => {
    expectedTotal += budgetByDay.get(d.format('YYYY-MM-DD')) ?? 0;
    actualTotal += spent[i];
    expected.push(Math.round(expectedTotal * 100) / 100);
    actual.push(Math.round(actualTotal * 100) / 100);
  });
  const money = (v: number | null) => format.money(v ?? 0, currency);

  return (
    <Frame loading={spending.isLoading || budget.isLoading} empty={!budget.data?.length && !spending.data?.length}>
      <LineChart
        height={HEIGHT}
        yAxis={Y_AXIS}
        xAxis={[{ scaleType: 'point', data: dayLabels(mode === 'daily' ? 'weekly' : mode, days) }]}
        series={[
          { label: t('chart_budget_expected'), data: expected, valueFormatter: money, showMark: false, curve: 'linear' },
          { label: t('chart_actual_spending'), data: actual, valueFormatter: money, area: true, curve: 'linear' },
        ]}
      />
    </Frame>
  );
}
