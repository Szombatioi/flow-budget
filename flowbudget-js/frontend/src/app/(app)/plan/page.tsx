'use client';

import { Box, Stack } from '@mui/material';
import { useTranslations } from 'next-intl';
import { AccountSelect } from '@/components/common/AccountSelect';
import { EmptyState, Loading, PageHeader } from '@/components/common/States';
import { AmountItemsCard } from '@/components/plan/AmountItemsCard';
import { CategoriesCard } from '@/components/plan/CategoriesCard';
import { PocketsCard } from '@/components/plan/PocketsCard';
import { useSelectedAccount } from '@/lib/use-selected-account';

export default function PlanPage() {
  const t = useTranslations();
  const { accounts, account, select, isLoading } = useSelectedAccount();

  if (isLoading) return <Loading />;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader title={t('nav_planning_and_setup')} actions={account && <AccountSelect accounts={accounts} value={account.id} onChange={select} />} />
      {!account ? (
        <EmptyState message={t('no_accounts_yet')} action={{ label: t('create_one_here'), href: '/accounts' }} />
      ) : (
        <Stack spacing={3}>
          <AmountItemsCard kind="incomes" account={account} />
          <AmountItemsCard kind="fixed-expenses" account={account} />
          <PocketsCard key={account.id} account={account} />
          <CategoriesCard />
        </Stack>
      )}
    </Box>
  );
}
