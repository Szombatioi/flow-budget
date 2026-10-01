'use client';

import { Box, Button, Card, CardContent, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { useFeedback } from '@/components/providers/Feedback';
import { authClient } from '@/lib/auth-client';

const ERROR_KEYS: Record<string, string> = {
  USERNAME_IS_ALREADY_TAKEN: 'user_already_exists',
  USER_ALREADY_EXISTS: 'user_already_exists',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'user_already_exists',
  PASSWORD_TOO_SHORT: 'password_too_short',
  PASSWORD_TOO_LONG: 'password_too_long',
  INVALID_EMAIL: 'invalid_email',
  USERNAME_TOO_SHORT: 'username_too_short',
  USERNAME_TOO_LONG: 'username_too_long',
  INVALID_USERNAME: 'invalid_username',
};

export default function RegisterPage() {
  const t = useTranslations();
  const { notify } = useFeedback();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ username: '', email: '', password: '', repeat: '' });
  const [loading, setLoading] = useState(false);
  const mismatch = form.repeat.length > 0 && form.password !== form.repeat;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.repeat) {
      notify(t('password_mismatch'), 'warning');
      return;
    }
    setLoading(true);
    const username = form.username.trim();
    const { error } = await authClient.signUp.email({ email: form.email.trim(), password: form.password, name: username, username });
    if (error) {
      setLoading(false);
      const key = error.code ? ERROR_KEYS[error.code] : undefined;
      notify(key ? t(key) : `${t('registration_failed')}${error.message ? `: ${error.message}` : ''}`, 'error');
      return;
    }
    notify(t('registration_success'));
    qc.clear();
    router.replace('/');
    router.refresh();
  };

  return (
    <Card>
      <title>{`${t('register')} | FlowBudget`}</title>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5" component="h1" align="center" sx={{ mb: 3 }}>
          {t('register')}
        </Typography>
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label={t('username')} value={form.username} onChange={set('username')} autoComplete="username" required autoFocus slotProps={{ htmlInput: { minLength: 3, maxLength: 50 } }} />
          <TextField label={t('email')} type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          <TextField label={t('password')} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
          <TextField
            label={t('repeat_password')}
            type="password"
            value={form.repeat}
            onChange={set('repeat')}
            autoComplete="new-password"
            required
            error={mismatch}
            helperText={mismatch ? t('password_mismatch') : undefined}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
            {t('create_user_account')}
          </Button>
        </Box>
        <Typography align="center" sx={{ mt: 3 }}>
          {t('already_have_account')}{' '}
          <Link component={NextLink} href="/auth/login">
            {t('login')}
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
