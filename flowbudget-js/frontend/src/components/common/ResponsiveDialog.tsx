'use client';

import { Dialog, type DialogProps, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

export function ResponsiveDialog({ maxWidth = 'sm', ...props }: DialogProps) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  return <Dialog fullWidth fullScreen={mobile} maxWidth={maxWidth} {...props} />;
}
