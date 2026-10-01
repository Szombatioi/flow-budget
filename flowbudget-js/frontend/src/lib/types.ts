export interface User {
  id: string;
  userName: string;
  email: string;
  accountIds: string[];
  theme: 'light' | 'dark' | null;
  language: string | null;
  hasApiKey: boolean;
}

export interface Currency {
  code: string;
  name: string;
  country: string | null;
}

export interface Account {
  id: string;
  name: string;
  currencyCode: string;
}

export interface Category {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
}

export interface AmountItem {
  id: string;
  lineageId: string;
  name: string;
  amount: number;
  activeFrom: string;
  upcoming: { name: string; amount: number; activeFrom: string; isDeleted: boolean } | null;
}

export interface Pocket {
  id: string;
  lineageId: string;
  planId: string;
  name: string;
  ration: number;
  activeFrom: string;
  upcoming: { name: string; ration: number; activeFrom: string; isDeleted: boolean } | null;
}

export interface Plan {
  id: string;
  name: string;
  isActive: boolean;
  isCurrent: boolean;
  activeFrom: string | null;
  account: Account;
  pockets: Pocket[];
}

export interface Expenditure {
  id: string;
  name: string;
  description: string | null;
  price: number;
  date: string;
  createdAt: string;
  currency: string;
  category: Category | null;
  pocketId: string;
  pocketName: string;
  accountId: string;
  wishlistId: string | null;
  wishlistName: string | null;
}

export interface DailyExpense {
  id: string;
  date: string;
  startAmount: number;
  eodAmount: number;
  relativeBudget: number;
  isStarted: boolean;
  wishlistId: string | null;
  currency: string;
  pocket: { id: string; lineageId: string; name: string; ration: number };
  expenditures: Expenditure[];
}

export interface NewExpenditure {
  pocketId: string;
  name: string;
  price: number;
  description?: string | null;
  categoryId?: string | null;
  date?: string;
}

export interface TimeSeriesItem {
  name: string;
  price: number;
  category: Category | null;
  date: string;
}

export interface BudgetSeriesItem {
  date: string;
  amount: number;
  startAmount: number;
  eodAmount: number;
  isStarted: boolean;
}

export interface DayOption {
  id: string;
  date: string;
  pocketName: string;
  wishlistId: string | null;
}

export type WishlistMode = 'manual' | 'automatic';
export type WishlistStatus = 'inactive' | 'active' | 'completed';

export interface Wishlist {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  mode: WishlistMode;
  status: WishlistStatus;
  currentAmount: number;
  targetAmount: number;
  targetDate: string;
  estimatedFinishDate: string | null;
  currencyCode: string;
  createdAt: string;
  affectedDailyExpenses?: { id: string; date: string; pocketName: string }[];
}

export interface ReceiptItem {
  name: string;
  price: number;
  categoryId: string | null;
}

export interface Paged<T> {
  total: number;
  items: T[];
}
