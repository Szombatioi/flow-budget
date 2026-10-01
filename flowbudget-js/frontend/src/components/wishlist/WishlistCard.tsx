'use client';

import BoltIcon from '@mui/icons-material/Bolt';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import PanToolIcon from '@mui/icons-material/PanTool';
import { Avatar, Box, Button, Card, CardContent, CardMedia, Chip, LinearProgress, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/format';
import type { Wishlist } from '@/lib/types';

export const STATUS_COLORS = { active: 'success', inactive: 'default', completed: 'primary' } as const;

export function WishlistCard({ wishlist, onOpen }: { wishlist: Wishlist; onOpen: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const progress = wishlist.targetAmount > 0 ? Math.min(100, (wishlist.currentAmount / wishlist.targetAmount) * 100) : 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {wishlist.imageUrl ? (
        <CardMedia component="img" height="160" image={wishlist.imageUrl} alt={wishlist.name} sx={{ objectFit: 'cover' }} />
      ) : (
        <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', color: 'text.secondary' }}>
          <CardGiftcardIcon sx={{ fontSize: 64 }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
          <Typography variant="h6" noWrap title={wishlist.name}>
            {wishlist.name}
          </Typography>
          <Chip size="small" color={STATUS_COLORS[wishlist.status]} label={t(`wishlist_status_${wishlist.status}`)} />
        </Box>
        {wishlist.description && (
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {wishlist.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>{wishlist.mode === 'automatic' ? <BoltIcon /> : <PanToolIcon fontSize="small" />}</Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {t(wishlist.mode === 'automatic' ? 'wishlist_approach_automatic' : 'wishlist_approach_manual')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('wishlist_estimated_finish')}: {wishlist.estimatedFinishDate ? format.date(wishlist.estimatedFinishDate) : '—'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 'auto' }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {format.money(wishlist.currentAmount, wishlist.currencyCode)} / {format.money(wishlist.targetAmount, wishlist.currencyCode)}
          </Typography>
          <LinearProgress variant="determinate" color="success" value={progress} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
          <Button variant="outlined" fullWidth onClick={onOpen}>
            {t('wishlist_display')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
