'use client';

import { useQuery } from '@tanstack/react-query';
import { api, query } from './api';
import type { Account, AmountItem, Category, Currency, Plan, User, Wishlist } from './types';

export const keys = {
  user: ['user'] as const,
  accounts: ['accounts'] as const,
  currencies: ['currencies'] as const,
  categories: ['categories'] as const,
  plans: (accountId: string) => ['plans', accountId] as const,
  effectivePlan: (accountId: string, date: string) => ['plans', accountId, 'effective', date] as const,
  incomes: (accountId: string) => ['incomes', accountId] as const,
  fixedExpenses: (accountId: string) => ['fixed-expenses', accountId] as const,
  wishlists: ['wishlists'] as const,
  wishlist: (id: string) => ['wishlists', id] as const,
  day: (pocketId: string, date: string) => ['day', pocketId, date] as const,
};

export const useUser = () => useQuery({ queryKey: keys.user, queryFn: () => api.get<User>('user') });
export const useAccounts = () => useQuery({ queryKey: keys.accounts, queryFn: () => api.get<Account[]>('accounts') });
export const useCurrencies = () => useQuery({ queryKey: keys.currencies, queryFn: () => api.get<Currency[]>('currencies'), staleTime: Infinity });
export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: () => api.get<Category[]>('categories') });
export const useWishlists = () => useQuery({ queryKey: keys.wishlists, queryFn: () => api.get<Wishlist[]>('wishlists') });

export const usePlans = (accountId: string | undefined) =>
  useQuery({ queryKey: keys.plans(accountId ?? ''), queryFn: () => api.get<Plan[]>(`plans/${accountId}`), enabled: !!accountId });

export const useEffectivePlan = (accountId: string | undefined, date: string) =>
  useQuery({
    queryKey: keys.effectivePlan(accountId ?? '', date),
    queryFn: async () => (await api.get<{ plan: Plan | null }>(`plans/${accountId}/effective${query({ date })}`)).plan,
    enabled: !!accountId,
  });

export const useAmountItems = (kind: 'incomes' | 'fixed-expenses', accountId: string | undefined) =>
  useQuery({
    queryKey: kind === 'incomes' ? keys.incomes(accountId ?? '') : keys.fixedExpenses(accountId ?? ''),
    queryFn: () => api.get<AmountItem[]>(`${kind}/${accountId}`),
    enabled: !!accountId,
  });
