'use client';

import { MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import type { Pocket } from '@/lib/types';
import type { ViewMode } from './data';

interface ChartControls {
  pocket?: Pocket;
  mode: ViewMode;
  date: Dayjs;
}

export function ChartCard({
  title,
  pockets,
  modes = ['weekly', 'monthly'],
  showPocket = true,
  children,
}: {
  title: string;
  pockets: Pocket[];
  modes?: ViewMode[];
  showPocket?: boolean;
  children: (controls: ChartControls) => ReactNode;
}) {
  const t = useTranslations();
  const [pocketId, setPocketId] = useState(pockets[0]?.id);
  const [mode, setMode] = useState<ViewMode>(modes.includes('weekly') ? 'weekly' : modes[0]);
  const [date, setDate] = useState(dayjs());
  const pocket = pockets.find((p) => p.id === pocketId) ?? pockets[0];

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1, fontSize: '1.05rem' }}>
        {title}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ mb: 2, flexWrap: { sm: 'wrap', xl: 'nowrap' }, '& > *': { flex: { sm: '1 1 160px' } } }}>
        {showPocket && (
          <TextField select size="small" label={t('pocket')} value={pocket?.id ?? ''} onChange={(e) => setPocketId(e.target.value)}>
            {pockets.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        )}
        {modes.length > 1 && (
          <TextField select size="small" label={t('view_mode')} value={mode} onChange={(e) => setMode(e.target.value as ViewMode)}>
            {modes.map((m) => (
              <MenuItem key={m} value={m}>
                {t(`view_mode_${m}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
        <DatePicker label={t('date')} value={date} onChange={(d) => d?.isValid() && setDate(d)} slotProps={{ textField: { size: 'small', fullWidth: true } }} />
      </Stack>
      {children({ pocket, mode, date })}
    </Paper>
  );
}
