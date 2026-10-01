'use client';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ImageIcon from '@mui/icons-material/Image';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { DATE_FORMAT, daysBetween } from '@/lib/dates';
import { useErrorMessage, useFormat } from '@/lib/format';
import type { Category, NewExpenditure, Pocket, ReceiptItem, Wishlist } from '@/lib/types';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { useFeedback } from '../providers/Feedback';

type TabKey = 'single' | 'receipt' | 'wishlist';

interface ReceiptRow extends ReceiptItem {
  include: boolean;
  price: number;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Splits an amount across days so that the parts add up exactly to the total.
export function splitAmount(total: number, parts: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? cents - base * (parts - 1) : base) / 100);
}

export function AddExpenseDialog({
  date,
  currency,
  pockets,
  defaultPocketId,
  categories,
  wishlists,
  hasApiKey,
  onClose,
  onSaved,
}: {
  date: string;
  currency: string;
  pockets: Pocket[];
  defaultPocketId?: string;
  categories: Category[];
  wishlists: Wishlist[];
  hasApiKey: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const format = useFormat();
  const errorMessage = useErrorMessage();
  const { notify } = useFeedback();

  const [tab, setTab] = useState<TabKey>('single');
  const [saving, setSaving] = useState(false);
  const [pocketId, setPocketId] = useState(defaultPocketId ?? pockets[0]?.id ?? '');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [day, setDay] = useState<Dayjs>(dayjs(date));
  const [description, setDescription] = useState('');
  const [split, setSplit] = useState(false);
  const [splitFrom, setSplitFrom] = useState<Dayjs | null>(null);
  const [splitTo, setSplitTo] = useState<Dayjs | null>(null);
  const [wishlistId, setWishlistId] = useState(wishlists[0]?.id ?? '');

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const price = Number(amount);
  const monthStart = day.startOf('month');
  const monthEnd = day.endOf('month');

  const splitPreview = useMemo(() => {
    if (!split || !splitFrom?.isValid() || !splitTo?.isValid() || splitTo.isBefore(splitFrom, 'day') || !(price > 0)) return [];
    const days = daysBetween(splitFrom, splitTo);
    const amounts = splitAmount(price, days.length);
    const base = name.trim() || t('split_unnamed');
    return days.map((d, i) => ({ name: `${base} (${i + 1})`, price: amounts[i], date: d.format(DATE_FORMAT) }));
  }, [split, splitFrom, splitTo, price, name, t]);

  const includedRows = rows?.filter((r) => r.include && r.name.trim() && r.price > 0) ?? [];

  const canSubmit =
    tab === 'single'
      ? name.trim().length > 0 && price > 0 && !!pocketId && (!split || splitPreview.length > 0)
      : tab === 'receipt'
        ? includedRows.length > 0 && !!pocketId
        : !!wishlistId && name.trim().length > 0 && price > 0 && !!pocketId;

  const submitLabel = () => {
    const count = tab === 'receipt' ? includedRows.length : tab === 'single' && split ? splitPreview.length : 0;
    return count > 0 ? `${t('add_transaction')} (${count})` : t('add_transaction');
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_FILE_BYTES) {
      notify(t('file_too_large'), 'error');
      return;
    }
    setFile(picked);
    setRows(null);
  };

  const scan = async () => {
    if (!file || !pocketId) return;
    setScanning(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const items = await api.post<ReceiptItem[]>(`daily-expenses/${pocketId}/receipt`, form);
      setRows(items.map((item) => ({ ...item, include: true })));
    } catch (e) {
      notify(errorMessage(e, 'upload_fail'), 'error');
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (index: number, patch: Partial<ReceiptRow>) => setRows((current) => current?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? null);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (tab === 'wishlist') {
        await api.post(`wishlists/${wishlistId}/move`, {
          pocketId,
          name: name.trim(),
          description: description.trim() || null,
          amount: Math.round(price * 100) / 100,
          date: day.format(DATE_FORMAT),
        });
      } else {
        let items: NewExpenditure[];
        if (tab === 'receipt') {
          items = includedRows.map((r) => ({ pocketId, name: r.name.trim(), price: Math.round(r.price * 100) / 100, categoryId: r.categoryId, date: day.format(DATE_FORMAT) }));
        } else if (split) {
          items = splitPreview.map((p) => ({ pocketId, name: p.name, price: p.price, date: p.date, categoryId: categoryId || null, description: description.trim() || null }));
        } else {
          items = [{ pocketId, name: name.trim(), price: Math.round(price * 100) / 100, date: day.format(DATE_FORMAT), categoryId: categoryId || null, description: description.trim() || null }];
        }
        await api.post('expenditures', { items });
      }
      notify(t('save_success'));
      onSaved();
    } catch (e) {
      notify(errorMessage(e, 'save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = format.currencySymbol(currency);
  const amountField = (
    <TextField
      label={t('amount')}
      type="number"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      required
      slotProps={{ htmlInput: { min: 0.01, step: '0.01' }, input: { endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> } }}
    />
  );
  const pocketField = (
    <TextField select label={t('pocket')} value={pocketId} onChange={(e) => setPocketId(e.target.value)}>
      {pockets.map((p) => (
        <MenuItem key={p.id} value={p.id}>
          {p.name}
        </MenuItem>
      ))}
    </TextField>
  );
  const categoryField = (value: string, onChange: (v: string) => void, size?: 'small') => (
    <TextField select size={size} label={size ? undefined : t('category')} value={value} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="">{t('chart_uncategorized')}</MenuItem>
      {categories.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {format.category(c)}
        </MenuItem>
      ))}
    </TextField>
  );
  const dateField = (
    <DatePicker
      label={t('date')}
      value={day}
      onChange={(d) => {
        if (d?.isValid()) {
          setDay(d);
          setSplitFrom(null);
          setSplitTo(null);
        }
      }}
      slotProps={{ textField: { fullWidth: true } }}
    />
  );
  const descriptionField = (
    <TextField
      label={t('description')}
      placeholder={t('description_placeholder')}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      multiline
      minRows={2}
      slotProps={{ htmlInput: { maxLength: 1000 } }}
    />
  );
  const nameField = (
    <TextField label={t('name')} placeholder={t('name_placeholder')} value={name} onChange={(e) => setName(e.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
  );

  return (
    <ResponsiveDialog open onClose={onClose}>
      <DialogTitle>
        {t('record_new_transaction')}
        <Typography variant="body2" color="text.secondary">
          {t('transaction_subtitle')}
        </Typography>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="single" label={t('single_expense_tab')} />
        <Tab
          value="receipt"
          label={
            hasApiKey ? (
              t('receipt_expense_tab')
            ) : (
              <Tooltip title={t('receipt_requires_api_key')}>
                <span>{t('receipt_expense_tab')}</span>
              </Tooltip>
            )
          }
          disabled={!hasApiKey}
          style={{ pointerEvents: 'auto' }}
        />
        <Tab value="wishlist" label={t('wishlist_move_tab')} disabled={wishlists.length === 0} />
      </Tabs>
      <DialogContent sx={{ minHeight: { sm: 420 } }}>
        {tab === 'single' && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {nameField}
            {amountField}
            {pocketField}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {categoryField(categoryId, setCategoryId)}
              {dateField}
            </Stack>
            {descriptionField}
            <FormControlLabel control={<Checkbox checked={split} onChange={(e) => setSplit(e.target.checked)} />} label={t('split_across_days')} />
            {split && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <DatePicker label={t('from')} value={splitFrom} onChange={setSplitFrom} minDate={monthStart} maxDate={splitTo ?? monthEnd} slotProps={{ textField: { fullWidth: true } }} />
                  <DatePicker label={t('to')} value={splitTo} onChange={setSplitTo} minDate={splitFrom ?? monthStart} maxDate={monthEnd} slotProps={{ textField: { fullWidth: true } }} />
                </Stack>
                {splitPreview.length > 0 && (
                  <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1, fontWeight: 700 }}>
                      {t('split_preview')} ({splitPreview.length} {t('split_days')})
                    </Typography>
                    {splitPreview.map((p) => (
                      <Box key={p.date} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 0.5, gap: 2 }}>
                        <Typography variant="body2" noWrap>
                          {p.name}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {format.date(p.date)} · {format.money(p.price, currency)}
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                )}
              </>
            )}
          </Stack>
        )}

        {tab === 'receipt' && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {pocketField}
            {dateField}
            {!file ? (
              <Box
                onClick={() => fileInput.current?.click()}
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                sx={{
                  border: 2,
                  borderStyle: 'dashed',
                  borderColor: dragging ? 'primary.main' : 'divider',
                  borderRadius: 3,
                  bgcolor: dragging ? 'action.hover' : 'transparent',
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.light' }} />
                <Typography variant="h6">{t('drop_zone_title')}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('drop_zone_hint')}
                </Typography>
                <Button variant="contained">{t('browse_files')}</Button>
                <input ref={fileInput} type="file" accept="image/*,application/pdf" hidden onChange={(e: ChangeEvent<HTMLInputElement>) => pickFile(e.target.files?.[0])} />
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5 }}>
                <ImageIcon color="primary" />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(0)} KB
                  </Typography>
                </Box>
                {rows && (
                  <Tooltip title={t('receipt_rescan')}>
                    <IconButton onClick={scan} disabled={scanning}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton
                  color="error"
                  onClick={() => {
                    setFile(null);
                    setRows(null);
                  }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Paper>
            )}
            {file && !rows && (
              <Button variant="contained" onClick={scan} disabled={scanning} startIcon={scanning ? <CircularProgress size={18} /> : undefined}>
                {scanning ? t('receipt_scanning') : t('upload')}
              </Button>
            )}
            {rows &&
              (rows.length === 0 ? (
                <Alert severity="warning">{t('receipt_no_items')}</Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('receipt_items_found')}: {rows.length}
                  </Typography>
                  <Stack spacing={1}>
                    {rows.map((row, i) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1, opacity: row.include ? 1 : 0.5 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                          <Checkbox checked={row.include} onChange={(e) => updateRow(i, { include: e.target.checked })} sx={{ alignSelf: 'flex-start' }} />
                          <TextField size="small" value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} aria-label={t('name')} />
                          <TextField
                            size="small"
                            type="number"
                            value={row.price}
                            onChange={(e) => updateRow(i, { price: Number(e.target.value) })}
                            aria-label={t('amount')}
                            sx={{ maxWidth: { sm: 150 } }}
                            slotProps={{ input: { endAdornment: <InputAdornment position="end">{currencySymbol}</InputAdornment> } }}
                          />
                          <Box sx={{ minWidth: { sm: 170 } }}>{categoryField(row.categoryId ?? '', (v) => updateRow(i, { categoryId: v || null }), 'small')}</Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              ))}
          </Stack>
        )}

        {tab === 'wishlist' && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField select label={t('wishlist')} value={wishlistId} onChange={(e) => setWishlistId(e.target.value)}>
              {wishlists.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </TextField>
            {pocketField}
            {amountField}
            {dateField}
            {nameField}
            {descriptionField}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit || saving}>
          {submitLabel()}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
