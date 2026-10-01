'use client';

import { useMemo } from 'react';
import { useAccounts } from './queries';
import { useLocalStorage } from './use-local-storage';

// The account picked on any page is remembered and reused by the other pages.
export function useSelectedAccount() {
  const accounts = useAccounts();
  const [storedId, select] = useLocalStorage('fb.accountId');

  const account = useMemo(() => {
    const list = accounts.data ?? [];
    return list.find((a) => a.id === storedId) ?? list[0];
  }, [accounts.data, storedId]);

  return { accounts: accounts.data ?? [], account, select, isLoading: accounts.isLoading, error: accounts.error };
}
