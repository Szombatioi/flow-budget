'use client';

import { Box, ButtonBase, Tooltip } from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import { useFormat } from '@/lib/format';
import { Loading } from '../common/States';
import { daysBetween, sumByDay, useBudgetSeries, useTimeSeries } from './data';

export function HeatmapCalendar({ pocketId, date, currency, selected, onSelect }: { pocketId?: string; date: Dayjs; currency: string; selected?: Dayjs; onSelect?: (day: Dayjs) => void }) {
  const format = useFormat();
  const from = date.startOf('month');
  const to = date.endOf('month').startOf('day');
  const days = daysBetween(from, to);
  const spending = useTimeSeries(pocketId, from, to);
  const budget = useBudgetSeries(pocketId, from, to);

  if (spending.isLoading || budget.isLoading) return <Loading />;

  const spent = sumByDay(spending.data ?? [], days);
  const budgetByDay = new Map((budget.data ?? []).map((b) => [b.date, b.startAmount]));
  const leading = (from.day() + 6) % 7;
  const headers = daysBetween(dayjs().day(1), dayjs().day(7)).map((d) => d.format('dd'));

  const color = (spentAmount: number, budgetAmount: number) => {
    if (spentAmount === 0) return null;
    const ratio = budgetAmount > 0 ? spentAmount / budgetAmount : Infinity;
    return ratio < 0.5 ? 'success.main' : ratio < 0.8 ? 'warning.main' : 'error.main';
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.5, sm: 1 }, width: '100%', maxWidth: 380, mx: 'auto', p: 1 }}>
      {headers.map((h) => (
        <Box key={h} sx={{ textAlign: 'center', typography: 'caption', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
          {h}
        </Box>
      ))}
      {Array.from({ length: leading }, (_, i) => (
        <Box key={`empty-${i}`} />
      ))}
      {days.map((d, i) => {
        const key = d.format('YYYY-MM-DD');
        const bg = color(spent[i], budgetByDay.get(key) ?? 0);
        const isSelected = selected?.isSame(d, 'day');
        return (
          <Tooltip key={key} title={`${format.date(key)}: ${format.money(spent[i], currency)}`}>
            <ButtonBase
              onClick={() => onSelect?.(d)}
              sx={{
                aspectRatio: '1',
                width: '100%',
                maxWidth: 44,
                mx: 'auto',
                borderRadius: '50%',
                typography: 'body2',
                fontWeight: 600,
                bgcolor: bg ?? 'transparent',
                color: bg ? 'common.white' : 'text.secondary',
                border: bg ? 'none' : 1,
                borderColor: 'divider',
                outline: isSelected ? 2 : 0,
                outlineColor: 'primary.main',
                outlineOffset: 2,
              }}
            >
              {d.date()}
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}
