'use client';

import { createTheme } from '@mui/material/styles';

export const DRAWER_WIDTH = 248;

// Locale objects from @mui/material/locale and @mui/x-date-pickers/locales.
export function buildTheme(...localizations: object[]) {
  return createTheme(
    {
      cssVariables: { colorSchemeSelector: 'class' },
      colorSchemes: {
        light: {
          palette: {
            primary: { main: '#2f55a4' },
            secondary: { main: '#0d1b3e' },
            background: { default: '#f0f1f2', paper: '#ffffff' },
            text: { primary: '#454748' },
          },
        },
        dark: {
          palette: {
            primary: { main: '#8ab4f8' },
            secondary: { main: '#c5d4f2' },
            background: { default: '#032f64', paper: '#0a3b78' },
          },
        },
      },
      shape: { borderRadius: 12 },
      typography: {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h4: { fontWeight: 700 },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 700 },
        button: { textTransform: 'none', fontWeight: 600 },
      },
      components: {
        MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiCard: { defaultProps: { variant: 'outlined' } },
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiTextField: { defaultProps: { fullWidth: true } },
      },
    },
    ...localizations,
  );
}
