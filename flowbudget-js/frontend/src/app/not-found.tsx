import { Box, Button, Typography } from '@mui/material';
import NextLink from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3, gap: 2 }}>
      <Typography variant="h3" component="h1">
        {t('page_not_found_title')}
      </Typography>
      <Typography color="text.secondary">{t('page_not_found_description')}</Typography>
      <Button component={NextLink} href="/" variant="contained">
        {t('nav_dashboard')}
      </Button>
    </Box>
  );
}
