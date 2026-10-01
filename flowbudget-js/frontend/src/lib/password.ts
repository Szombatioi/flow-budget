'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from './api';

export interface PublicConfig {
  signUpEnabled: boolean;
  minPasswordLength: number;
  requireStrongPasswords: boolean;
}

export const usePublicConfig = () => useQuery({ queryKey: ['public-config'], queryFn: () => api.get<PublicConfig>('public-config'), staleTime: Infinity });

const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

// Mirrors the backend rule; returns the translation key of the problem, if any.
export function passwordProblem(password: string, config: PublicConfig | undefined): string | null {
  if (!config) return null;
  if (password.length < config.minPasswordLength) return 'password_too_short';
  if (config.requireStrongPasswords && CHARACTER_CLASSES.filter((p) => p.test(password)).length < 3) return 'password_too_weak';
  return null;
}

export function usePasswordHint(config: PublicConfig | undefined): string | undefined {
  const t = useTranslations();
  if (!config) return undefined;
  return t(config.requireStrongPasswords ? 'password_requirements' : 'password_requirements_length', { min: config.minPasswordLength });
}
