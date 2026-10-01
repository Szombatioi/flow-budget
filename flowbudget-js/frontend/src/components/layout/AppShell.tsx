'use client';

import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BarChartIcon from '@mui/icons-material/BarChart';
import ChecklistIcon from '@mui/icons-material/Checklist';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useColorScheme, useTheme } from '@mui/material/styles';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { LOCALE_COOKIE } from '@/i18n/config';
import { authClient } from '@/lib/auth-client';
import { useUser } from '@/lib/queries';
import { DRAWER_WIDTH } from '@/lib/theme';
import { useFeedback } from '../providers/Feedback';

const NAV = [
  { href: '/', label: 'nav_dashboard', icon: <DashboardIcon /> },
  { href: '/accounts', label: 'nav_accounts', icon: <AccountBalanceWalletIcon /> },
  { href: '/plan', label: 'nav_planning_and_setup', icon: <SettingsSuggestIcon /> },
  { href: '/expenses', label: 'nav_expenses', icon: <AttachMoneyIcon /> },
  { href: '/wishlist', label: 'nav_wishlist', icon: <ChecklistIcon /> },
  { href: '/statistics', label: 'nav_statistics', icon: <BarChartIcon /> },
];

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { setMode } = useColorScheme();
  const { notify } = useFeedback();
  const { data: user } = useUser();
  const [open, setOpen] = useState(false);

  // Apply the preferences stored on the server (they follow the user across devices).
  useEffect(() => {
    if (!user) return;
    if (user.theme) setMode(user.theme);
    if (user.language && user.language !== locale) {
      document.cookie = `${LOCALE_COOKIE}=${user.language}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [user, locale, setMode, router]);

  const logout = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      notify(t('something_went_wrong'), 'error');
      return;
    }
    router.replace('/auth/login');
    router.refresh();
  };

  const current = [...NAV, { href: '/settings', label: 'nav_settings' }, { href: '/export', label: 'export_page_title' }].find((item) =>
    isActive(pathname, item.href),
  );

  const navItem = (href: string, label: string, icon: ReactNode) => (
    <ListItemButton
      key={href}
      component={NextLink}
      href={href}
      selected={isActive(pathname, href)}
      onClick={() => setOpen(false)}
      sx={{ borderRadius: 2, mx: 1, mb: 0.5 }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
      <ListItemText primary={t(label)} />
    </ListItemButton>
  );

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 3, py: 2.5 }}>
        <Typography variant="h5" color="primary">
          FlowBudget
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('slogan')}
        </Typography>
      </Box>
      <Divider sx={{ mb: 1 }} />
      <List sx={{ flexGrow: 1 }}>{NAV.map((item) => navItem(item.href, item.label, item.icon))}</List>
      <List>
        {user && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, pb: 1 }} noWrap>
            {user.userName}
          </Typography>
        )}
        {navItem('/settings', 'nav_settings', <SettingsIcon />)}
        <ListItemButton onClick={logout} sx={{ borderRadius: 2, mx: 1 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary={t('nav_logout')} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <title>{current ? `${t(current.label)} | FlowBudget` : 'FlowBudget'}</title>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar>
          {!desktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label={t('toggle_navigation')} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" noWrap>
            {current ? t(current.label) : 'FlowBudget'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || open}
          onClose={() => setOpen(false)}
          slotProps={{ paper: { sx: { width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' } } }}
          ModalProps={{ keepMounted: true }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, px: { xs: 1.5, sm: 3 }, pb: 4 }}>
        <Toolbar />
        <Box sx={{ pt: { xs: 2, sm: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
