'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ArrowUpRight, ArrowDownLeft, Wallet, LogOut, History, PieChart as PieChartIcon, Settings, Target, BarChart3, Calendar, Trash2, Edit2, X, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'saving';
  amount: number;
  category: string;
  date: any;
  description: string;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [newTx, setNewTx] = useState({
    type: 'expense' as 'income' | 'expense' | 'saving',
    amount: '',
    category: 'Food',
    description: ''
  });

  const incomeCategories = [
    'Company',
    'Part time',
    'Freelance',
    'Other'
  ];

  const expenseCategories = [
    'Transportation',
    'Food',
    'Shopping',
    'Electric Bill',
    'Water Bill',
    'Phone Bill',
    'Statutory Contributions',
    'Rent',
    'Friendly transfer',
    'Changed to cash',
    'Balance adjustment',
    'Other'
  ];

  const getCategories = () => {
    if (newTx.type === 'income') return incomeCategories;
    if (newTx.type === 'expense') return expenseCategories;
    return [];
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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
        setPermissionError(false);
        setIndexError(null);
      },
      (error) => {
        console.error("Transactions fetch error:", error);
        if (error.code === 'permission-denied') {
          console.log("%c TRANSACTIONS PERMISSION DENIED", "background: #991b1b; color: white; padding: 4px;");
          console.log("%c DEBUG: Your Project ID is: " + process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "background: #e0f2fe; color: #075985; font-weight: bold; padding: 4px; border-radius: 4px;");
          console.log("%c DEBUG: Your UID is: " + user.uid, "background: #fee2e2; color: #991b1b; font-weight: bold; padding: 4px; border-radius: 4px;");
          setPermissionError(true);
          setTransactions([]);
        } else if (error.message.includes('requires an index')) {
          // Extract the link from the error message if possible
          const linkMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
          setIndexError(linkMatch ? linkMatch[0] : 'https://console.firebase.google.com');
          setTransactions([]);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', user.uid));
        if (settingsDoc.exists()) {
          setDailyLimit(settingsDoc.data().dailyLimit || 0);
        }
        setPermissionError(false);
      } catch (error: any) {
        console.error("Settings fetch error:", error);
        if (error.code === 'permission-denied') {
          console.log("%c SETTINGS PERMISSION DENIED", "background: #991b1b; color: white; padding: 4px;");
          setPermissionError(true);
        }
      }
    };

    fetchSettings();
  }, [user]);

  const totals = transactions.reduce((acc, tx) => {
    if (tx.type === 'income') acc.income += tx.amount;
    if (tx.type === 'expense') acc.expense += tx.amount;
    if (tx.type === 'saving') acc.savings += tx.amount;
    return acc;
  }, { income: 0, expense: 0, savings: 0 });

  const balance = totals.income - totals.expense;

  const todaySpending = transactions
    .filter(tx => {
      if (!tx.date) return false;
      const txDate = tx.date.toDate();
      const today = new Date();
      return tx.type === 'expense' && 
             txDate.getDate() === today.getDate() &&
             txDate.getMonth() === today.getMonth() &&
             txDate.getFullYear() === today.getFullYear();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTx.amount || !db) return;

    if (editingTx) {
      await updateDoc(doc(db, 'transactions', editingTx.id), {
        type: newTx.type,
        amount: parseFloat(newTx.amount),
        category: newTx.category,
        description: newTx.description,
      });
    } else {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: newTx.type,
        amount: parseFloat(newTx.amount),
        category: newTx.category || 'General',
        description: newTx.description,
        date: serverTimestamp()
      });
    }

    setIsAdding(false);
    setEditingTx(null);
    setNewTx({ type: 'expense', amount: '', category: 'Food', description: '' });
  };

  const handleDeleteTx = async (id: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'transactions', id));
  };

  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setNewTx({
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
      description: tx.description
    });
    setIsAdding(true);
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    await setDoc(doc(db, 'settings', user.uid), {
      dailyLimit: dailyLimit
    }, { merge: true });

    setIsSettingsOpen(false);
  };

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

  if (loading || !user) return null;

  // Prepare chart data
  const chartData = transactions.slice().reverse().map(tx => ({
    date: tx.date ? format(tx.date.toDate(), 'MMM d') : '',
    amount: tx.type === 'expense' ? -tx.amount : tx.amount,
  }));

  return (
    <div className="max-w-md mx-auto min-h-screen bg-stone-50 pb-24">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-medium text-stone-900">ZenWealth</h1>
          <div className="flex items-center gap-2 text-stone-500">
            <Calendar className="w-3 h-3" />
            <p className="text-xs">{format(new Date(), 'EEEE, MMMM do')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/reports"
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
          </Link>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => auth?.signOut()}
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {permissionError && (
        <section className="px-6 mb-6">
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[32px] space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="p-2 bg-rose-100 rounded-full">
                <X className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold">Firestore Rules Required</p>
            </div>
            
            <p className="text-xs text-rose-600 leading-relaxed">
              Your database is still locked. To fix this instantly, please use the <b>Master Unlock</b> rules below. Copy and paste them into your <b>Firebase Console &gt; Firestore Database &gt; Rules</b> tab.
            </p>

            <div className="bg-white/50 p-3 rounded-xl border border-rose-100 space-y-2">
              <div>
                <p className="text-[10px] text-rose-400 uppercase tracking-widest mb-1">Your Project ID</p>
                <code className="text-xs text-rose-800 font-mono">{process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</code>
              </div>
              <div>
                <p className="text-[10px] text-rose-400 uppercase tracking-widest mb-1">Your User ID (UID)</p>
                <code className="text-xs text-rose-800 break-all font-mono">{user.uid}</code>
              </div>
              <p className="text-[9px] text-rose-400 italic">
                Make sure you are editing the Rules for the Project ID shown above.
              </p>
            </div>

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
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Master Rules'}
              </button>
            </div>

            <p className="text-[10px] text-rose-400 italic">
              After clicking &quot;Publish&quot; in the Firebase Console, refresh this page.
            </p>
          </div>
        </section>
      )}

      {indexError && (
        <section className="px-6 mb-6">
          <div className="bg-amber-50 border border-amber-100 p-5 rounded-3xl space-y-3">
            <p className="text-sm text-amber-700 font-semibold">Database Index Required</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              This query requires a composite index to sort your transactions by date. Please click the link below to create it automatically in your Firebase Console:
            </p>
            <a 
              href={indexError} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block w-full text-center bg-amber-600 text-white py-3 rounded-xl text-xs font-medium shadow-sm active:scale-95 transition-transform"
            >
              Create Index in Firebase Console
            </a>
            <p className="text-[10px] text-amber-400 pt-1 text-center italic">
              It may take a few minutes for the index to build.
            </p>
          </div>
        </section>
      )}

      {/* Balance Card */}
      <section className="px-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-stone-900 rounded-3xl p-8 text-white shadow-xl shadow-stone-200"
        >
          <p className="text-stone-400 text-sm mb-1 font-light uppercase tracking-widest">Cash Amount</p>
          <h2 className="text-4xl font-light mb-8">${balance.toLocaleString()}</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-full">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-tighter">Income</p>
                <p className="text-sm font-medium">${totals.income.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-full">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-tighter">Expenses</p>
                <p className="text-sm font-medium">${totals.expense.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Daily Usage Limit */}
      {dailyLimit > 0 && (
        <section className="px-6 mb-8">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-stone-400" />
                <p className="text-sm font-medium text-stone-900">Daily Usage Limit</p>
              </div>
              <p className="text-xs text-stone-500">
                ${todaySpending.toLocaleString()} / ${dailyLimit.toLocaleString()}
              </p>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((todaySpending / dailyLimit) * 100, 100)}%` }}
                className={`h-full transition-colors ${
                  todaySpending > dailyLimit ? 'bg-rose-500' : 'bg-stone-900'
                }`}
              />
            </div>
            {todaySpending > dailyLimit && (
              <p className="text-[10px] text-rose-500 font-medium uppercase tracking-wider">
                Daily limit exceeded by ${(todaySpending - dailyLimit).toLocaleString()}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Savings Goal / Stat */}
      <section className="px-6 mb-8">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-stone-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Total Savings</p>
              <p className="text-xs text-stone-500">Wealth accumulation</p>
            </div>
          </div>
          <p className="text-lg font-medium text-emerald-600">${totals.savings.toLocaleString()}</p>
        </div>
      </section>

      {/* Chart */}
      <section className="px-6 mb-8">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="amount" stroke="#1c1917" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent Transactions */}
      <section className="px-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-stone-900">Recent Activity</h3>
          <button className="text-xs text-stone-500 hover:text-stone-900">View All</button>
        </div>
        <div className="space-y-3">
          {transactions.slice(0, 10).map((tx) => (
            <motion.div 
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="group bg-white border border-stone-100 p-4 rounded-2xl flex items-center justify-between hover:border-stone-300 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 
                  tx.type === 'expense' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : 
                   tx.type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">{tx.description || tx.category}</p>
                  <p className="text-xs text-stone-400">{tx.date ? format(tx.date.toDate(), 'MMM d, h:mm a') : 'Pending'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    tx.type === 'income' ? 'text-emerald-600' : 
                    tx.type === 'expense' ? 'text-rose-600' : 'text-blue-600'
                  }`}>
                    {tx.type === 'expense' ? '-' : '+'}${tx.amount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-stone-400">{tx.category}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => startEdit(tx)}
                    className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteTx(tx.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-12 text-stone-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No transactions yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsAdding(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-stone-900 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAdding && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-8 z-50 max-w-md mx-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium">{editingTx ? 'Edit Transaction' : 'New Transaction'}</h3>
                {editingTx && (
                  <button 
                    onClick={() => {
                      setIsAdding(false);
                      setEditingTx(null);
                      setNewTx({ type: 'expense', amount: '', category: 'Food', description: '' });
                    }}
                    className="p-2 text-stone-400 hover:text-stone-900"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              <form onSubmit={handleAddTx} className="space-y-6">
                <div className="flex gap-2 p-1 bg-stone-100 rounded-xl">
                  {(['expense', 'income', 'saving'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const defaultCat = type === 'income' ? 'Company' : type === 'expense' ? 'Food' : '';
                        setNewTx({ ...newTx, type, category: defaultCat });
                      }}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-all ${
                        newTx.type === type ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-stone-400 uppercase tracking-wider">Amount</label>
                  <input 
                    autoFocus
                    type="number" 
                    placeholder="0.00"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    className="w-full text-4xl font-light bg-transparent border-none focus:ring-0 p-0 text-stone-900 placeholder:text-stone-200"
                  />
                </div>

                <div className="space-y-4">
                  {newTx.type !== 'saving' && (
                    <div className="space-y-2">
                      <label className="text-xs text-stone-400 uppercase tracking-wider">Category</label>
                      <div className="grid grid-cols-3 gap-2">
                        {getCategories().map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setNewTx({ ...newTx, category: cat })}
                            className={`py-2 px-1 text-[10px] font-medium rounded-xl border transition-all ${
                              newTx.category === cat 
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md' 
                                : 'bg-white border-stone-100 text-stone-500 hover:border-stone-300'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-xs text-stone-400 uppercase tracking-wider">Description</label>
                    <input 
                      type="text" 
                      placeholder={newTx.type === 'saving' ? "What are you saving for?" : "Description (optional)"}
                      value={newTx.description}
                      onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                      className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:border-stone-300 transition-colors"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium shadow-lg active:scale-95 transition-transform"
                >
                  {editingTx ? 'Update Transaction' : 'Add Transaction'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-8 z-50 max-w-md mx-auto"
            >
              <div className="w-12 h-1 bg-stone-200 rounded-full mx-auto mb-8" />
              <h3 className="text-xl font-medium mb-6">Settings</h3>
              
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs text-stone-400 uppercase tracking-wider">Daily Usage Limit</label>
                  <input 
                    autoFocus
                    type="number" 
                    placeholder="0.00"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(parseFloat(e.target.value) || 0)}
                    className="w-full text-4xl font-light bg-transparent border-none focus:ring-0 p-0 text-stone-900 placeholder:text-stone-200"
                  />
                  <p className="text-xs text-stone-400 pt-2">
                    Set a maximum amount you want to spend each day.
                  </p>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium shadow-lg active:scale-95 transition-transform"
                >
                  Save Settings
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
