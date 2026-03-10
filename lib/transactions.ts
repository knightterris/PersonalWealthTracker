import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';

export interface Transaction {
  id: string;
  userId?: string;
  type: 'income' | 'expense' | 'saving';
  amount: number;
  category: string;
  date?: Timestamp | null;
  description: string;
}

export interface MonthlyReport {
  monthKey: string;
  monthName: string;
  year: string;
  totalIncome: number;
  totalExpense: number;
  totalSaving: number;
  company: number;
  partTime: number;
  freelance: number;
  transportation: number;
  food: number;
  rent: number;
  bills: number;
  statutory: number;
}

export const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{transactionId} {
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    match /settings/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;
    }
  }
}`;

export const toDateSafe = (value?: Timestamp | null) => {
  if (!value || typeof value.toDate !== 'function') return null;
  const date = value.toDate();
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTransactionDate = (value?: Timestamp | null) => {
  const date = toDateSafe(value);
  return date ? format(date, 'MMM d, h:mm a') : 'Pending';
};

export const getSignedAmount = (transaction: Pick<Transaction, 'type' | 'amount'>) => {
  return transaction.type === 'expense' ? -transaction.amount : transaction.amount;
};

export const generateMonthlyReports = (transactions: Transaction[]): MonthlyReport[] => {
  const grouped: Record<string, MonthlyReport> = {};

  transactions.forEach((transaction) => {
    const date = toDateSafe(transaction.date);
    if (!date) return;

    const monthKey = format(date, 'yyyy-MM');

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        monthKey,
        monthName: format(date, 'MMMM'),
        year: format(date, 'yyyy'),
        totalIncome: 0,
        totalExpense: 0,
        totalSaving: 0,
        company: 0,
        partTime: 0,
        freelance: 0,
        transportation: 0,
        food: 0,
        rent: 0,
        bills: 0,
        statutory: 0,
      };
    }

    const report = grouped[monthKey];

    if (transaction.type === 'income') {
      report.totalIncome += transaction.amount;
      if (transaction.category === 'Company') report.company += transaction.amount;
      if (transaction.category === 'Part time') report.partTime += transaction.amount;
      if (transaction.category === 'Freelance') report.freelance += transaction.amount;
      return;
    }

    if (transaction.type === 'expense') {
      report.totalExpense += transaction.amount;
      if (transaction.category === 'Transportation') report.transportation += transaction.amount;
      if (transaction.category === 'Food') report.food += transaction.amount;
      if (transaction.category === 'Rent') report.rent += transaction.amount;
      if (['Electric Bill', 'Water Bill', 'Phone Bill'].includes(transaction.category)) {
        report.bills += transaction.amount;
      }
      if (transaction.category === 'Statutory Contributions') report.statutory += transaction.amount;
      return;
    }

    report.totalSaving += transaction.amount;
  });

  return Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
};
