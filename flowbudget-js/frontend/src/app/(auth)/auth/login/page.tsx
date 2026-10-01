'use client';

import { Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, Link, TextField, Typography } from '@mui/material';
import NextLink from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, Suspense, useState } from 'react';
import { useFeedback } from '@/components/providers/Feedback';
import { authClient } from '@/lib/auth-client';

function LoginForm() {
  const t = useTranslations();
  const { notify } = useFeedback();
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const login = identifier.trim();
    const { error } = login.includes('@')
      ? await authClient.signIn.email({ email: login, password, rememberMe })
      : await authClient.signIn.username({ username: login, password, rememberMe });
    if (error) {
      setLoading(false);
      notify(t('invalid_credentials'), 'error');
      return;
    }
    const redirect = searchParams.get('redirect');
    qc.clear();
    router.replace(redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/');
    router.refresh();
  };

  return (
    <Card>
      <title>{`${t('login')} | FlowBudget`}</title>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5" component="h1" align="center" sx={{ mb: 3 }}>
          {t('login')}
        </Typography>
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label={t('username_or_email')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus />
          <TextField
            label={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <FormControlLabel control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />} label={t('remember_me')} />
          <Button type="submit" variant="contained" size="large" disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
            {t('login_button')}
          </Button>
        </Box>
        <Typography align="center" sx={{ mt: 3 }}>
          {t('no_account_yet')}{' '}
          <Link component={NextLink} href="/auth/register">
            {t('register')}
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
