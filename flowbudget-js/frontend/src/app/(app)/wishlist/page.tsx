'use client';

import AddIcon from '@mui/icons-material/Add';
import ChecklistIcon from '@mui/icons-material/Checklist';
import { Box, Button, Grid } from '@mui/material';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { WishlistCard } from '@/components/wishlist/WishlistCard';
import { WishlistDetailsDialog } from '@/components/wishlist/WishlistDetailsDialog';
import { useWishlists } from '@/lib/queries';

export default function WishlistPage() {
  const t = useTranslations();
  const wishlists = useWishlists();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Box>
      <PageHeader
        title={t('wishlist_page_title')}
        actions={
          <Button component={NextLink} href="/wishlist/new" variant="contained" startIcon={<AddIcon />}>
            {t('create_new_wishlist')}
          </Button>
        }
      />
      {wishlists.isLoading ? (
        <Loading />
      ) : !wishlists.data?.length ? (
        <EmptyState icon={<ChecklistIcon />} message={t('wishlist_empty')} />
      ) : (
        <Grid container spacing={2}>
          {wishlists.data.map((w) => (
            <Grid key={w.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <WishlistCard wishlist={w} onOpen={() => setOpenId(w.id)} />
            </Grid>
          ))}
        </Grid>
      )}
      {openId && <WishlistDetailsDialog id={openId} onClose={() => setOpenId(null)} />}
    </Box>
  );
}
