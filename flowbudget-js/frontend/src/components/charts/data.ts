'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { api, query } from '@/lib/api';
import { DATE_FORMAT, daysBetween, monthRange, weekRange } from '@/lib/dates';
import type { BudgetSeriesItem, TimeSeriesItem } from '@/lib/types';

export type ViewMode = 'daily' | 'weekly' | 'monthly';

export function rangeFor(mode: ViewMode, date: Dayjs): [Dayjs, Dayjs] {
  if (mode === 'daily') return [date.startOf('day'), date.startOf('day')];
  return mode === 'weekly' ? weekRange(date) : monthRange(date);
}

export function dayLabels(mode: ViewMode, days: Dayjs[]): string[] {
  return days.map((d) => (mode === 'weekly' ? d.format('dd') : d.format('MM.DD')));
}

const rangeQuery = (from: Dayjs, to: Dayjs) => query({ from: from.format(DATE_FORMAT), to: to.format(DATE_FORMAT) });

export function useTimeSeries(pocketId: string | undefined, from: Dayjs, to: Dayjs) {
  return useQuery({
    queryKey: ['day', 'time-series', pocketId, from.format(DATE_FORMAT), to.format(DATE_FORMAT)],
    queryFn: () => api.get<TimeSeriesItem[]>(`daily-expenses/${pocketId}/time-series${rangeQuery(from, to)}`),
    enabled: !!pocketId,
  });
}

export function useBudgetSeries(pocketId: string | undefined, from: Dayjs, to: Dayjs) {
  return useQuery({
    queryKey: ['day', 'budget-series', pocketId, from.format(DATE_FORMAT), to.format(DATE_FORMAT)],
    queryFn: () => api.get<BudgetSeriesItem[]>(`daily-expenses/${pocketId}/budget-series${rangeQuery(from, to)}`),
    enabled: !!pocketId,
  });
}

export function useTimeSeriesForPockets(pocketIds: string[], from: Dayjs, to: Dayjs) {
  return useQueries({
    queries: pocketIds.map((id) => ({
      queryKey: ['day', 'time-series', id, from.format(DATE_FORMAT), to.format(DATE_FORMAT)],
      queryFn: () => api.get<TimeSeriesItem[]>(`daily-expenses/${id}/time-series${rangeQuery(from, to)}`),
    })),
  });
}

export function sumByDay(items: TimeSeriesItem[], days: Dayjs[]): number[] {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.date, (totals.get(item.date) ?? 0) + item.price);
  return days.map((d) => Math.round((totals.get(d.format(DATE_FORMAT)) ?? 0) * 100) / 100);
}

export { daysBetween };
