'use client';

import dayjs from 'dayjs';
import '@/lib/dates';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';
import type { Category } from './types';

export function useFormat() {
  const t = useTranslations();
  const locale = useLocale();

  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const currencySymbol = (code: string) => {
      const key = `currency_${code.toLowerCase()}_short`;
      return t.has(key) ? t(key) : code;
    };
    return {
      number: (value: number) => number.format(value),
      money: (value: number, currencyCode: string) => `${number.format(value)} ${currencySymbol(currencyCode)}`,
      currencySymbol,
      category: (category: Category | null | undefined) =>
        !category ? t('chart_uncategorized') : category.isSystem && t.has(category.displayName) ? t(category.displayName) : category.displayName,
      date: (value: string) => dayjs(value).locale(locale).format('L'),
      longDate: (value: string) => dayjs(value).locale(locale).format(locale === 'hu' ? 'LL, dddd' : 'dddd, LL'),
      month: (value: string) => dayjs(value).locale(locale).format(locale === 'hu' ? 'YYYY. MMMM' : 'MMMM YYYY'),
    };
  }, [t, locale]);
}

export function useErrorMessage() {
  const t = useTranslations();
  return useCallback(
    (error: unknown, fallback = 'something_went_wrong') => {
      const code = error instanceof ApiError ? error.code : null;
      return code && t.has(code) ? t(code) : t(fallback);
    },
    [t],
  );
}
