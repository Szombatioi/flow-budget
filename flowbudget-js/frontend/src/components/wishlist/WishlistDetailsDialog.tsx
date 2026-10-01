'use client';

import { Box, Button, CardMedia, Chip, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Fragment, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage, useFormat } from '@/lib/format';
import { keys } from '@/lib/queries';
import type { Wishlist } from '@/lib/types';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { Loading } from '../common/States';
import { useFeedback } from '../providers/Feedback';
import { STATUS_COLORS } from './WishlistCard';

export function WishlistDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations();
  const format = useFormat();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const wishlist = useQuery({ queryKey: keys.wishlist(id), queryFn: () => api.get<Wishlist>(`wishlists/${id}`) });
  const w = wishlist.data;

  const act = async (action: () => Promise<unknown>, closeAfter = false) => {
    setBusy(true);
    try {
      await action();
      notify(t('save_success'));
      qc.invalidateQueries({ queryKey: keys.wishlists });
      qc.invalidateQueries({ queryKey: ['day'] });
      if (closeAfter) onClose();
    } catch (e) {
      notify(errorMessage(e, 'save_error'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (!w) return;
    const activating = w.status !== 'active';
    const ok = await confirm({
      title: t(activating ? 'wishlist_activate' : 'wishlist_deactivate'),
      description: t(activating ? 'wishlist_activate_confirm' : 'wishlist_deactivate_confirm'),
      destructive: false,
    });
    if (ok) await act(() => api.post(`wishlists/${w.id}/${activating ? 'activate' : 'deactivate'}`));
  };

  const remove = async () => {
    if (w && (await confirm({ title: t('wishlist_delete'), description: t('wishlist_delete_confirm') }))) await act(() => api.delete(`wishlists/${w.id}`), true);
  };

  const rows: [string, string][] = w
    ? [
        [t('wishlist_approach'), t(w.mode === 'automatic' ? 'wishlist_approach_automatic' : 'wishlist_approach_manual')],
        [t('wishlist_progress'), `${format.money(w.currentAmount, w.currencyCode)} / ${format.money(w.targetAmount, w.currencyCode)}`],
        [t('wishlist_target_date'), format.date(w.targetDate)],
        [t('wishlist_estimated_finish'), w.estimatedFinishDate ? format.date(w.estimatedFinishDate) : '—'],
      ]
    : [];

  return (
    <ResponsiveDialog open onClose={onClose}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box component="span" sx={{ flexGrow: 1 }}>
          {w?.name}
        </Box>
        {w && <Chip size="small" color={STATUS_COLORS[w.status]} label={t(`wishlist_status_${w.status}`)} />}
      </DialogTitle>
      <DialogContent>
        {wishlist.isLoading || !w ? (
          <Loading />
        ) : (
          <>
            {w.imageUrl && <CardMedia component="img" image={w.imageUrl} alt={w.name} sx={{ height: 180, objectFit: 'cover', borderRadius: 2, mb: 2 }} />}
            {w.description && (
              <Typography color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {w.description}
              </Typography>
            )}
            <LinearProgress variant="determinate" color="success" value={Math.min(100, (w.currentAmount / w.targetAmount) * 100)} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
            {rows.map(([label, value], i) => (
              <Fragment key={label}>
                {i > 0 && <Divider />}
                <Box sx={{ py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography>{value}</Typography>
                </Box>
              </Fragment>
            ))}
            {!!w.affectedDailyExpenses?.length && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  {t('wishlist_affected_des')}
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                  {w.affectedDailyExpenses.map((d) => (
                    <Typography key={d.id} variant="body2" sx={{ py: 0.5 }}>
                      {format.date(d.date)} ({d.pocketName})
                    </Typography>
                  ))}
                </Paper>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button color="error" onClick={remove} disabled={!w || busy}>
          {t('delete')}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>{t('close')}</Button>
        <Button variant="contained" onClick={toggle} disabled={!w || busy || w.status === 'completed'}>
          {w?.status === 'active' ? t('wishlist_deactivate') : t('wishlist_activate')}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
