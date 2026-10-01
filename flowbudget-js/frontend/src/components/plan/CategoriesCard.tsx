'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LabelIcon from '@mui/icons-material/Label';
import { Button, Chip, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage, useFormat } from '@/lib/format';
import { keys, useCategories } from '@/lib/queries';
import type { Category } from '@/lib/types';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { Loading, SectionCard } from '../common/States';
import { useFeedback } from '../providers/Feedback';

export function CategoriesCard() {
  const t = useTranslations();
  const format = useFormat();
  const qc = useQueryClient();
  const { notify, confirm } = useFeedback();
  const errorMessage = useErrorMessage();
  const categories = useCategories();
  const [dialog, setDialog] = useState<{ category?: Category } | null>(null);
  const [name, setName] = useState('');

  const open = (category?: Category) => {
    setName(category?.displayName ?? '');
    setDialog({ category });
  };

  const save = useMutation({
    mutationFn: () => (dialog?.category ? api.put(`categories/${dialog.category.id}`, { name: name.trim() }) : api.post('categories', { name: name.trim() })),
    onSuccess: () => {
      notify(t('save_success'));
      setDialog(null);
      qc.invalidateQueries({ queryKey: keys.categories });
    },
    onError: (e) => notify(errorMessage(e, 'save_error'), 'error'),
  });

  const remove = async (category: Category) => {
    if (!(await confirm({ title: t('delete_category_title'), description: t('delete_category_confirm_description') }))) return;
    try {
      await api.delete(`categories/${category.id}`);
      notify(t('item_deleted'));
      qc.invalidateQueries({ queryKey: keys.categories });
    } catch (e) {
      notify(errorMessage(e, 'delete_error'), 'error');
    }
  };

  return (
    <SectionCard title={t('categories_title')} icon={<LabelIcon />}>
      {categories.isLoading ? (
        <Loading />
      ) : (
        <List disablePadding>
          {(categories.data ?? []).map((category) => (
            <ListItem
              key={category.id}
              divider
              secondaryAction={
                category.isSystem ? (
                  <Chip size="small" variant="outlined" label={t('system_category')} />
                ) : (
                  <>
                    <IconButton aria-label={t('edit_category')} onClick={() => open(category)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label={t('delete')} color="error" onClick={() => remove(category)}>
                      <DeleteIcon />
                    </IconButton>
                  </>
                )
              }
            >
              <ListItemText primary={format.category(category)} />
            </ListItem>
          ))}
        </List>
      )}
      <Button startIcon={<AddIcon />} onClick={() => open()} sx={{ mt: 2 }}>
        {t('add_category')}
      </Button>
      {dialog && (
        <ResponsiveDialog open onClose={() => setDialog(null)} maxWidth="xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate();
            }}
          >
            <DialogTitle>{dialog.category ? t('edit_category') : t('add_category')}</DialogTitle>
            <DialogContent>
              <TextField autoFocus label={t('category_name_label')} value={name} onChange={(e) => setName(e.target.value)} sx={{ mt: 1 }} slotProps={{ htmlInput: { maxLength: 50 } }} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialog(null)}>{t('cancel')}</Button>
              <Button type="submit" variant="contained" disabled={!name.trim() || save.isPending}>
                {dialog.category ? t('save') : t('add')}
              </Button>
            </DialogActions>
          </form>
        </ResponsiveDialog>
      )}
    </SectionCard>
  );
}
