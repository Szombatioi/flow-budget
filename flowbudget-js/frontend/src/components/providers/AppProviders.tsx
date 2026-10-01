'use client';

import { CssBaseline } from '@mui/material';
import { enUS, huHU } from '@mui/material/locale';
import { ThemeProvider } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { enUS as pickersEn, huHU as pickersHu } from '@mui/x-date-pickers/locales';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import '@/lib/dates';
import { buildTheme } from '@/lib/theme';
import { FeedbackProvider } from './Feedback';

export function AppProviders({ locale, children }: { locale: string; children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => {
    const queryClient: QueryClient = new QueryClient({
      // An expired session sends the user back to the login page.
      queryCache: new QueryCache({
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401 && !window.location.pathname.startsWith('/auth')) {
            queryClient.clear();
            router.replace(`/auth/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          }
        },
      }),
      defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1, refetchOnWindowFocus: false } },
    });
    return queryClient;
  });

  const theme = useMemo(() => (locale === 'hu' ? buildTheme(huHU, pickersHu) : buildTheme(enUS, pickersEn)), [locale]);
  dayjs.locale(locale);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme} defaultMode="light">
        <CssBaseline enableColorScheme />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
          <FeedbackProvider>{children}</FeedbackProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
