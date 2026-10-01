'use client';

import { Box, Button, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Loading, PageHeader } from '@/components/common/States';
import { useFeedback } from '@/components/providers/Feedback';
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/format';
import { passwordProblem, usePasswordHint, usePublicConfig } from '@/lib/password';
import { keys, useUser } from '@/lib/queries';
import type { User } from '@/lib/types';

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hu: 'Magyar' };

function Section({ title, hint, children, onSubmit }: { title: string; hint?: string; children: ReactNode; onSubmit: (e: FormEvent) => void }) {
  return (
    <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h6" component="h2" sx={{ mb: hint ? 0.5 : 2 }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
      )}
      <Stack spacing={2}>{children}</Stack>
    </Paper>
  );
}

export default function SettingsPage() {
  const user = useUser();
  if (user.isLoading || !user.data) return <Loading />;
  return <SettingsForm user={user.data} />;
}

function SettingsForm({ user }: { user: User }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const { notify } = useFeedback();
  const errorMessage = useErrorMessage();
  const { setMode } = useColorScheme();

  const [userName, setUserName] = useState(user.userName);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const passwordConfig = usePublicConfig();
  const passwordHint = usePasswordHint(passwordConfig.data);
  const newPasswordProblem = passwords.next ? passwordProblem(passwords.next, passwordConfig.data) : null;
  const [dark, setDark] = useState(user.theme === 'dark');
  const [language, setLanguage] = useState(user.language ?? locale);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState('');
  const [savePassword, setSavePassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      notify(t(success));
      qc.invalidateQueries({ queryKey: keys.user });
    } catch (e) {
      notify(errorMessage(e, 'save_error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto' }}>
      <PageHeader title={t('nav_settings')} />
      <Stack spacing={3}>
        <Section
          title={t('settings_profile_section')}
          onSubmit={(e) => {
            e.preventDefault();
            run('profile', () => api.put('user/profile', { userName: userName.trim() }), 'settings_profile_saved');
          }}
        >
          <TextField
            label={t('username')}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            slotProps={{ htmlInput: { minLength: 3, maxLength: 50 } }}
          />
          <TextField label={t('email')} value={user.email} slotProps={{ input: { readOnly: true } }} />
          <Box>
            <Button type="submit" variant="contained" disabled={busy === 'profile'}>
              {busy === 'profile' ? t('saving') : t('save')}
            </Button>
          </Box>
        </Section>

        <Section
          title={t('settings_security_section')}
          onSubmit={(e) => {
            e.preventDefault();
            if (newPasswordProblem) {
              notify(t(newPasswordProblem), 'warning');
              return;
            }
            if (passwords.next !== passwords.confirm) {
              notify(t('settings_password_mismatch'), 'warning');
              return;
            }
            run(
              'password',
              async () => {
                await api.put('user/password', { currentPassword: passwords.current, newPassword: passwords.next });
                setPasswords({ current: '', next: '', confirm: '' });
              },
              'settings_password_changed',
            );
          }}
        >
          <TextField
            label={t('settings_current_password')}
            type="password"
            autoComplete="current-password"
            value={passwords.current}
            onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
            required
          />
          <TextField
            label={t('settings_new_password')}
            type="password"
            autoComplete="new-password"
            value={passwords.next}
            onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
            required
            error={!!newPasswordProblem}
            helperText={newPasswordProblem ? t(newPasswordProblem) : passwordHint}
          />
          <TextField
            label={t('settings_confirm_password')}
            type="password"
            autoComplete="new-password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            required
            error={passwords.confirm.length > 0 && passwords.confirm !== passwords.next}
          />
          <Box>
            <Button type="submit" variant="contained" disabled={busy === 'password'}>
              {busy === 'password' ? t('saving') : t('settings_change_password')}
            </Button>
          </Box>
        </Section>

        <Section
          title={t('settings_preferences_section')}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              'preferences',
              async () => {
                await api.put('user/preferences', { theme: dark ? 'dark' : 'light', language });
                if (language !== locale) {
                  document.cookie = `${LOCALE_COOKIE}=${language}; path=/; max-age=31536000; samesite=lax`;
                  router.refresh();
                }
              },
              'settings_preferences_saved',
            );
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{t('settings_theme_light')}</Typography>
            <Switch
              checked={dark}
              onChange={(e) => {
                setDark(e.target.checked);
                setMode(e.target.checked ? 'dark' : 'light');
              }}
              slotProps={{ input: { 'aria-label': t('settings_theme') } }}
            />
            <Typography variant="body2">{t('settings_theme_dark')}</Typography>
          </Box>
          <TextField select label={t('settings_language')} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LOCALES.map((l) => (
              <MenuItem key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <Button type="submit" variant="contained" disabled={busy === 'preferences'}>
              {busy === 'preferences' ? t('saving') : t('save')}
            </Button>
          </Box>
        </Section>

        {apiKey === null ? (
          <Section
            title={t('settings_api_key_section')}
            hint={`${t('settings_api_key_hint')} ${user.hasApiKey ? t('settings_api_key_set') : t('settings_api_key_not_set')}`}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy('reveal');
              try {
                const res = await api.post<{ apiKey: string | null }>('user/api-key/reveal', { password: revealPassword });
                setApiKey(res.apiKey ?? '');
                setRevealPassword('');
              } catch {
                notify(t('invalid_credentials'), 'error');
              } finally {
                setBusy(null);
              }
            }}
          >
            <TextField
              label={t('settings_enter_password_to_reveal')}
              type="password"
              autoComplete="current-password"
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              required
            />
            <Box>
              <Button type="submit" variant="contained" disabled={busy === 'reveal'}>
                {t('settings_reveal')}
              </Button>
            </Box>
          </Section>
        ) : (
          <Section
            title={t('settings_api_key_section')}
            onSubmit={(e) => {
              e.preventDefault();
              run(
                'apikey',
                async () => {
                  await api.put('user/api-key', { password: savePassword, apiKey: apiKey.trim() || null });
                  setSavePassword('');
                },
                'settings_api_key_saved',
              );
            }}
          >
            <TextField
              label={t('settings_api_key_label')}
              placeholder={t('settings_api_key_placeholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <TextField
              label={t('settings_confirm_with_password')}
              type="password"
              autoComplete="current-password"
              value={savePassword}
              onChange={(e) => setSavePassword(e.target.value)}
              required
            />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={busy === 'apikey'}>
                {busy === 'apikey' ? t('saving') : t('save')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setApiKey(null);
                  setSavePassword('');
                }}
              >
                {t('settings_hide')}
              </Button>
            </Stack>
          </Section>
        )}
      </Stack>
    </Box>
  );
}
