'use client';

import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { monthStartStr, todayStr, upcomingMonths } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import { keys, useAmountItems, usePlans } from '@/lib/queries';
import type { Account, Plan, Pocket } from '@/lib/types';
import { MonthDialog } from '../common/MonthDialog';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { Loading, SectionCard } from '../common/States';
import { useFeedback } from '../providers/Feedback';

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export function PocketsCard({ account }: { account: Account }) {
  const t = useTranslations();
  const format = useFormat();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();
  const plans = usePlans(account.id);
  const incomes = useAmountItems('incomes', account.id);
  const fixed = useAmountItems('fixed-expenses', account.id);
  const [planId, setPlanId] = useState<string>();
  const [pocketDialog, setPocketDialog] = useState<{ pocket?: Pocket } | null>(null);
  const [deleting, setDeleting] = useState<Pocket | null>(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [activating, setActivating] = useState(false);

  const list = plans.data ?? [];
  const plan = list.find((p) => p.id === planId) ?? list.find((p) => p.isCurrent) ?? list.find((p) => p.isActive) ?? list[0];
  const pockets = plan?.pockets ?? [];
  const distributable = sum((incomes.data ?? []).map((i) => i.amount)) - sum((fixed.data ?? []).map((f) => f.amount));
  const totalRatio = sum(pockets.map((p) => p.ration));
  const ratioOk = Math.abs(totalRatio - 100) < 0.01;
  const currentMonth = monthStartStr(todayStr());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.plans(account.id) });
    qc.invalidateQueries({ queryKey: ['day'] });
  };

  const run = async (action: () => Promise<unknown>, success: string, fallbackError = 'save_error') => {
    try {
      await action();
      notify(t(success));
      invalidate();
      return true;
    } catch (e) {
      notify(errorMessage(e, fallbackError), 'error');
      return false;
    }
  };

  const planLabel = (p: Plan) => {
    if (p.isCurrent) return t('plan_status_current');
    if (p.isActive && p.activeFrom) return t('plan_status_scheduled', { month: format.month(p.activeFrom) });
    if (p.isActive) return t('active');
    return t('plan_status_inactive');
  };

  const deletePlan = async () => {
    if (!plan || !(await confirm({ title: t('delete_plan_title'), description: t('delete_plan_confirm_description') }))) return;
    if (await run(() => api.delete(`plans/${plan.id}`), 'item_deleted', 'delete_error')) setPlanId(undefined);
  };

  const otherActive = list.some((p) => p.isActive && p.id !== plan?.id);
  const activationMin = otherActive ? upcomingMonths(2)[1] : currentMonth;

  return (
    <SectionCard title={t('pockets_title')} icon={<BarChartIcon />}>
      {plans.isLoading ? (
        <Loading />
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
            {list.length > 0 && (
              <TextField select size="small" label={t('select_division_plan')} value={plan?.id ?? ''} onChange={(e) => setPlanId(e.target.value)} sx={{ flex: 1, minWidth: 220 }}>
                {list.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                      <span>{p.name}</span>
                      <Typography component="span" variant="caption" color={p.isCurrent ? 'success.main' : 'text.secondary'}>
                        {planLabel(p)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setNewPlanOpen(true)} sx={{ whiteSpace: 'nowrap' }}>
                {list.length ? t('new_plan') : t('create_first_plan')}
              </Button>
              {plan && !plan.isActive && (
                <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setActivating(true)} disabled={pockets.length === 0}>
                  {t('activate')}
                </Button>
              )}
              {plan && (
                <Tooltip title={t('delete_plan_title')}>
                  <IconButton size="small" color="error" onClick={deletePlan}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {plan && (
            <>
              {plan.isActive && plan.activeFrom && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('plan_active_from', { month: format.month(plan.activeFrom) })}
                </Typography>
              )}
              {pockets.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 2 }}>
                  {t('no_pockets_for_plan')}
                </Typography>
              ) : (
                <List disablePadding>
                  {pockets.map((pocket) => (
                    <ListItem
                      key={pocket.lineageId}
                      divider
                      sx={{ pr: 12 }}
                      secondaryAction={
                        <>
                          <IconButton aria-label={t('edit_pocket')} onClick={() => setPocketDialog({ pocket })}>
                            <EditIcon />
                          </IconButton>
                          <IconButton aria-label={t('delete')} color="error" onClick={() => setDeleting(pocket)}>
                            <DeleteIcon />
                          </IconButton>
                        </>
                      }
                    >
                      <ListItemText
                        primary={pocket.name}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                            <Chip size="small" color="info" label={`${format.number(pocket.ration)} %`} />
                            <span>{format.money((distributable * pocket.ration) / 100, account.currencyCode)}</span>
                            {pocket.upcoming && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={
                                  pocket.upcoming.isDeleted
                                    ? t('upcoming_removal', { month: format.month(pocket.upcoming.activeFrom) })
                                    : t('upcoming_change', { month: format.month(pocket.upcoming.activeFrom), value: `${format.number(pocket.upcoming.ration)} %` })
                                }
                              />
                            )}
                          </Box>
                        }
                        slotProps={{ secondary: { component: 'div' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              {pockets.length > 0 && !ratioOk && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {t('ratio_warning_not_100')}
                </Alert>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 2 }}>
                <Button startIcon={<AddIcon />} onClick={() => setPocketDialog({})}>
                  {t('add_pocket')}
                </Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('total_ratio')}
                  </Typography>
                  <Chip color={ratioOk ? 'success' : 'warning'} label={`${format.number(totalRatio)} % / 100 %`} />
                </Box>
              </Box>
            </>
          )}
        </>
      )}

      {newPlanOpen && (
        <NameDialog
          title={t('add_new_plan')}
          label={t('division_plan_name_label')}
          onClose={() => setNewPlanOpen(false)}
          onSave={async (name) => {
            try {
              const { id } = await api.post<{ id: string }>('plans', { accountId: account.id, name });
              notify(t('plan_created'));
              setNewPlanOpen(false);
              setPlanId(id);
              invalidate();
            } catch (e) {
              notify(errorMessage(e, 'error_creating_plan'), 'error');
            }
          }}
        />
      )}

      {plan && activating && (
        <MonthDialog
          open
          title={t('activate_plan_title')}
          description={otherActive ? t('activate_plan_next_month_hint') : t('activate_plan_description')}
          minMonth={activationMin}
          onClose={() => setActivating(false)}
          onConfirm={async (from) => {
            if (await run(() => api.post(`plans/${plan.id}/activate`, { from }), 'plan_activated', 'plan_activate_error')) setActivating(false);
          }}
        />
      )}

      {plan && pocketDialog && (
        <PocketDialog
          plan={plan}
          pocket={pocketDialog.pocket}
          pockets={pockets}
          distributable={distributable}
          currency={account.currencyCode}
          onClose={() => setPocketDialog(null)}
          onSave={async ({ name, ration, from }) => {
            const ok = await run(
              () => (pocketDialog.pocket ? api.put(`pockets/${pocketDialog.pocket.id}`, { name, ration, from }) : api.post(`pockets/${plan.id}`, { name, ration, from })),
              'save_success',
            );
            if (ok) setPocketDialog(null);
          }}
        />
      )}

      {deleting && (
        <DeletePocketDialog
          pocket={deleting}
          others={pockets.filter((p) => p.lineageId !== deleting.lineageId)}
          onClose={() => setDeleting(null)}
          onConfirm={async (targetId) => {
            const params = targetId ? `?targetPocketId=${targetId}` : '';
            if (await run(() => api.delete(`pockets/${deleting.id}${params}`), 'item_deleted', 'delete_error')) setDeleting(null);
          }}
        />
      )}
    </SectionCard>
  );
}

function NameDialog({ title, label, onClose, onSave }: { title: string; label: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const t = useTranslations();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setSaving(true);
          await onSave(name.trim());
          setSaving(false);
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField autoFocus label={label} value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || saving}>
            {t('create')}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}

function PocketDialog({
  plan,
  pocket,
  pockets,
  distributable,
  currency,
  onClose,
  onSave,
}: {
  plan: Plan;
  pocket?: Pocket;
  pockets: Pocket[];
  distributable: number;
  currency: string;
  onClose: () => void;
  onSave: (values: { name: string; ration: number; from?: string }) => Promise<void>;
}) {
  const t = useTranslations();
  const format = useFormat();
  const months = useMemo(() => upcomingMonths(13).filter((m) => !plan.activeFrom || m >= plan.activeFrom).slice(0, 12), [plan.activeFrom]);
  const [name, setName] = useState(pocket?.name ?? '');
  const [ratio, setRatio] = useState(pocket ? String(pocket.ration) : '');
  const [from, setFrom] = useState(months[0]);
  const [saving, setSaving] = useState(false);

  const value = Number(ratio);
  const usedByOthers = sum(pockets.filter((p) => p.lineageId !== pocket?.lineageId).map((p) => p.ration));
  const remaining = 100 - usedByOthers - (Number.isFinite(value) ? value : 0);
  const valid = name.trim().length > 0 && ratio !== '' && value >= 0 && value <= 100 && remaining > -0.001;
  const ratioChanged = !pocket || value !== pocket.ration;
  const askMonth = plan.isActive && ratioChanged;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    await onSave({ name: name.trim(), ration: value, from: askMonth ? from : undefined });
    setSaving(false);
  };

  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{pocket ? t('edit_pocket') : t('add_pocket')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField autoFocus label={t('pocket_name_label')} value={name} onChange={(e) => setName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField
              label={t('pocket_ratio_label')}
              type="number"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              required
              error={remaining < -0.001}
              helperText={remaining < -0.001 ? t('ratio_exceed_limit') : undefined}
              slotProps={{ htmlInput: { min: 0, max: 100, step: '0.1' }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
            />
            <Alert severity={remaining < -0.001 ? 'error' : 'info'}>
              {t('remaining_ratio')}: {format.number(remaining)} %
            </Alert>
            <Typography variant="body2">
              <b>{t('money_amount')}:</b> {format.money((distributable * (Number.isFinite(value) ? value : 0)) / 100, currency)}
            </Typography>
            {askMonth && (
              <TextField select label={t('select_allow_from_title')} value={from} onChange={(e) => setFrom(e.target.value)} helperText={t('select_allow_from_description')}>
                {months.map((m) => (
                  <MenuItem key={m} value={m}>
                    {format.month(m)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="contained" disabled={!valid || saving}>
            {pocket ? t('save') : t('add')}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
}

function DeletePocketDialog({ pocket, others, onClose, onConfirm }: { pocket: Pocket; others: Pocket[]; onClose: () => void; onConfirm: (targetId?: string) => Promise<void> }) {
  const t = useTranslations();
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog open onClose={onClose} maxWidth="xs">
      <DialogTitle>{t('delete_pocket_title')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('delete_pocket_confirm_description', { name: pocket.name })}</DialogContentText>
        {others.length > 0 && (
          <TextField select label={t('delete_pocket_target')} value={target} onChange={(e) => setTarget(e.target.value)} helperText={t('delete_pocket_target_hint')}>
            {others.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(target || undefined);
            setBusy(false);
          }}
        >
          {t('delete')}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
