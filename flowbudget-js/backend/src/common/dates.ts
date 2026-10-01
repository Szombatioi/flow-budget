// Calendar dates are handled as 'YYYY-MM-DD' strings (Postgres DATE) to avoid timezone drift.
// "Today" is resolved in the server's timezone (configure with the TZ environment variable).

export type DateStr = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(date: Date): DateStr {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): DateStr {
  return toDateStr(new Date());
}

export function parts(date: DateStr): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function isValidDateStr(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parts(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function monthStart(date: DateStr): DateStr {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: DateStr, months: number): DateStr {
  const { y, m } = parts(date);
  const index = y * 12 + (m - 1) + months;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
}

export function monthEnd(date: DateStr): DateStr {
  const { y, m } = parts(date);
  return `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`;
}

export function addDays(date: DateStr, days: number): DateStr {
  const { y, m, d } = parts(date);
  return toDateStr(new Date(y, m - 1, d + days));
}

export function daysOfMonth(date: DateStr): DateStr[] {
  const { y, m } = parts(date);
  return Array.from({ length: daysInMonth(y, m) }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

export function diffDays(from: DateStr, to: DateStr): number {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

// Monday-based week start.
export function weekStart(date: DateStr): DateStr {
  const { y, m, d } = parts(date);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(date, -dow);
}

export function monthsBetween(from: DateStr, to: DateStr): DateStr[] {
  const result: DateStr[] = [];
  for (let month = monthStart(from); month <= monthStart(to); month = addMonths(month, 1)) result.push(month);
  return result;
}
