'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'saving';
  amount: number;
  category: string;
  date: any;
  description: string;
}

interface MonthlyReport {
  monthKey: string; // e.g. "2024-02"
  monthName: string; // e.g. "February"
  year: string; // e.g. "2024"
  totalIncome: number;
  totalExpense: number;
  // Income breakdown
  company: number;
  partTime: number;
  freelance: number;
  // Expense breakdown
  transportation: number;
  food: number;
  rent: number;
  bills: number;
  statutory: number;
}

export default function ReportsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [permissionError, setPermissionError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const copyRules = () => {
    const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Master Unlock Rule: Allows you to access all your data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
    navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateReports = (txs: Transaction[]) => {
    const grouped: Record<string, MonthlyReport> = {};

    txs.forEach(tx => {
      if (!tx.date) return;
      const date = tx.date.toDate();
      const monthKey = format(date, 'yyyy-MM');
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName: format(date, 'MMMM'),
          year: format(date, 'yyyy'),
          totalIncome: 0,
          totalExpense: 0,
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

      if (tx.type === 'income') {
        report.totalIncome += tx.amount;
        if (tx.category === 'Company') report.company += tx.amount;
        if (tx.category === 'Part time') report.partTime += tx.amount;
        if (tx.category === 'Freelance') report.freelance += tx.amount;
      } else if (tx.type === 'expense') {
        report.totalExpense += tx.amount;
        
        if (tx.category === 'Transportation') report.transportation += tx.amount;
        if (tx.category === 'Food') report.food += tx.amount;
        if (tx.category === 'Rent') report.rent += tx.amount;
        if (['Electric Bill', 'Water Bill', 'Phone Bill'].includes(tx.category)) {
          report.bills += tx.amount;
        }
        if (tx.category === 'Statutory Contributions') report.statutory += tx.amount;
      }
    });

    const sortedReports = Object.values(grouped).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    setReports(sortedReports);
  };

  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const txs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setTransactions(txs);
        generateReports(txs);
        setPermissionError(false);
      },
      (error) => {
        console.error("Transactions fetch error (Reports):", error);
        if (error.code === 'permission-denied') {
          console.log("%c TRANSACTIONS PERMISSION DENIED (Reports)", "background: #991b1b; color: white; padding: 4px;");
          setPermissionError(true);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-stone-50 pb-12">
      {/* Header */}
      <header className="p-6 flex items-center gap-4">
        <Link href="/" className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-medium text-stone-900">Monthly Reports</h1>
      </header>

      <main className="px-6 space-y-8">
        {permissionError && (
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[32px] space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2 bg-rose-100 rounded-full">
                <Calendar className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold">Database Access Denied</p>
            </div>
            
            <p className="text-xs text-rose-600 leading-relaxed">
              Your database is still locked. To fix this instantly, please use the <b>Master Unlock</b> rules below. Copy and paste them into your <b>Firebase Console &gt; Firestore Database &gt; Rules</b> tab.
            </p>

            <div className="relative group">
              <pre className="text-[10px] bg-white border border-rose-100 p-4 rounded-2xl overflow-x-auto text-rose-800 font-mono leading-tight max-h-48">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}
              </pre>
              <button 
                onClick={copyRules}
                className="absolute top-2 right-2 p-2 bg-stone-900 text-white rounded-lg shadow-lg active:scale-95 transition-all flex items-center gap-2 text-[10px]"
              >
                {copied ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Master Rules'}
              </button>
            </div>

            <p className="text-[10px] text-rose-400 italic">
              After clicking &quot;Publish&quot; in the Firebase Console, refresh this page.
            </p>
          </div>
        )}

        {!permissionError && reports.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">No data available for reports yet.</p>
          </div>
        ) : (
          reports.map((report) => (
            <motion.div 
              key={report.monthKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-stone-200 rounded-[32px] overflow-hidden shadow-sm"
            >
              <div className="bg-stone-900 p-6 text-white">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="text-2xl font-light">{report.monthName}</h2>
                  <span className="text-xs text-stone-400 uppercase tracking-widest">{report.year}</span>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-tighter mb-1">Total Income</p>
                    <p className="text-lg font-medium text-emerald-400">${report.totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] text-stone-400 uppercase tracking-tighter mb-1">Total Expense</p>
                    <p className="text-lg font-medium text-rose-400">${report.totalExpense.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-100 pb-1">Income Breakdown</p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <ReportItem label="Company" value={report.company} />
                    <ReportItem label="Part Time" value={report.partTime} />
                    <ReportItem label="Freelance" value={report.freelance} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-100 pb-1">Expense Breakdown</p>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <ReportItem label="Transportation" value={report.transportation} />
                    <ReportItem label="Food" value={report.food} />
                    <ReportItem label="Rent" value={report.rent} />
                    <ReportItem label="Bills" value={report.bills} />
                    <ReportItem label="Statutory" value={report.statutory} />
                  </div>
                </div>

                <ReportItem 
                  label="Net Savings" 
                  value={report.totalIncome - report.totalExpense} 
                  isHighlight 
                  isPositive={report.totalIncome >= report.totalExpense}
                />
              </div>
            </motion.div>
          ))
        )}
      </main>
    </div>
  );
}

function ReportItem({ label, value, isHighlight = false, isPositive = true }: { 
  label: string; 
  value: number; 
  isHighlight?: boolean;
  isPositive?: boolean;
}) {
  return (
    <div className={isHighlight ? "col-span-2 pt-4 border-t border-stone-100" : ""}>
      <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${
        isHighlight 
          ? (isPositive ? 'text-emerald-600' : 'text-rose-600') 
          : 'text-stone-900'
      }`}>
        ${value.toLocaleString()}
      </p>
    </div>
  );
}
