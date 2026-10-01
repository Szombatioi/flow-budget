import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/hu';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(localizedFormat);

export const DATE_FORMAT = 'YYYY-MM-DD';

export const todayStr = () => dayjs().format(DATE_FORMAT);
export const toDateStr = (d: Dayjs) => d.format(DATE_FORMAT);
export const parseDate = (s: string) => dayjs(s, DATE_FORMAT);
export const monthStartStr = (d: Dayjs | string) => dayjs(d).startOf('month').format(DATE_FORMAT);
export const isValidDateStr = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && dayjs(s).isValid();

export function weekRange(d: Dayjs): [Dayjs, Dayjs] {
  const start = d.subtract((d.day() + 6) % 7, 'day').startOf('day');
  return [start, start.add(6, 'day')];
}

export function monthRange(d: Dayjs): [Dayjs, Dayjs] {
  return [d.startOf('month'), d.endOf('month').startOf('day')];
}

// Inclusive day range; empty for invalid dates (e.g. while a date field is still being typed).
export function daysBetween(from: Dayjs, to: Dayjs): Dayjs[] {
  if (!from.isValid() || !to.isValid()) return [];
  const days: Dayjs[] = [];
  for (let d = from.startOf('day'); !d.isAfter(to, 'day'); d = d.add(1, 'day')) days.push(d);
  return days;
}

export function upcomingMonths(count = 12, from = dayjs()): string[] {
  return Array.from({ length: count }, (_, i) => from.startOf('month').add(i, 'month').format(DATE_FORMAT));
}
