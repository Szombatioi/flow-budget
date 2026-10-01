import { Box, Container, Typography } from '@mui/material';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', py: 4, bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" component="div" color="primary">
            FlowBudget
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('slogan')}
          </Typography>
        </Box>
        {children}
      </Container>
    </Box>
  );
}
