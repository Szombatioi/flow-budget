'use client';

import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import NextLink from 'next/link';
import type { ReactNode } from 'react';

export function Loading() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress />
    </Box>
  );
}

export function EmptyState({ icon, message, action }: { icon?: ReactNode; message: ReactNode; action?: { label: string; href: string } }) {
  return (
    <Paper sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
      {icon && <Box sx={{ color: 'text.secondary', mb: 1, '& svg': { fontSize: 48 } }}>{icon}</Box>}
      <Typography color="text.secondary">{message}</Typography>
      {action && (
        <Button component={NextLink} href={action.href} variant="contained" sx={{ mt: 2 }}>
          {action.label}
        </Button>
      )}
    </Paper>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
      <Box>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Box>
  );
}

export function SectionCard({ title, icon, children, actions }: { title: string; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {icon && <Box sx={{ display: 'flex', color: 'primary.main' }}>{icon}</Box>}
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {actions}
      </Box>
      {children}
    </Paper>
  );
}
