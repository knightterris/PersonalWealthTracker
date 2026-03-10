"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Search,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth-provider";
import {
  Transaction,
  formatTransactionDate,
  getSignedAmount,
  toDateSafe,
} from "@/lib/transactions";

const PAGE_SIZE = 20;

const formatCurrency = (amount: number) => `฿${amount.toLocaleString()}`;

const startOfDay = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`);
};

const endOfDay = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T23:59:59.999`);
};

const getTransactionLabel = (type: Transaction["type"]) => {
  if (type === "income") return "In";
  if (type === "expense") return "Out";
  return "Saving";
};

const getTransactionTone = (type: Transaction["type"]) => {
  if (type === "income") return "bg-emerald-50 text-emerald-700";
  if (type === "expense") return "bg-rose-50 text-rose-700";
  return "bg-blue-50 text-blue-700";
};

export default function TransactionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !db) return;

    const transactionQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc"),
    );

    const unsubscribe = onSnapshot(transactionQuery, (snapshot) => {
      const nextTransactions = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Transaction[];

      setTransactions(nextTransactions);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredTransactions = useMemo(() => {
    const start = startOfDay(appliedStartDate);
    const end = endOfDay(appliedEndDate);

    return transactions.filter((transaction) => {
      const date = toDateSafe(transaction.date);
      if (!date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  }, [transactions, appliedStartDate, appliedEndDate]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE,
  );

  const pageTotal = paginatedTransactions.reduce(
    (sum, transaction) => sum + getSignedAmount(transaction),
    0,
  );

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setDraftStartDate("");
    setDraftEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setCurrentPage(1);
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-6xl mx-auto min-h-screen bg-stone-50 pb-12 px-4 sm:px-6">
      <header className="py-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-medium text-stone-900">
              All Transactions
            </h1>
            <p className="text-sm text-stone-500">
              Browse up to 20 records per page with date filtering.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleApplyFilters}
          className="w-full lg:w-auto lg:min-w-[440px] bg-white border border-stone-200 rounded-2xl p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-stone-500 uppercase tracking-wider">
              Start
              <input
                type="date"
                value={draftStartDate}
                onChange={(event) => setDraftStartDate(event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-400"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-stone-500 uppercase tracking-wider">
              End
              <input
                type="date"
                value={draftEndDate}
                onChange={(event) => setDraftEndDate(event.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-stone-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Clear
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
            >
              <Search className="w-4 h-4" />
              Apply
            </button>
          </div>
        </form>
      </header>

      <main className="space-y-6">
        <section className="bg-white border border-stone-200 rounded-[28px] shadow-sm overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-20 text-stone-400 px-6">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm">
                No transactions found for the selected date range.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-stone-100 text-stone-500 uppercase text-xs tracking-wider">
                    <tr>
                      <th className="px-6 py-4 text-left font-medium">
                        In / Out
                      </th>
                      <th className="px-6 py-4 text-left font-medium">
                        Date &amp; Time
                      </th>
                      <th className="px-6 py-4 text-left font-medium">
                        Description / Category
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((transaction) => {
                      const signedAmount = getSignedAmount(transaction);
                      const label = getTransactionLabel(transaction.type);

                      return (
                        <tr
                          key={transaction.id}
                          className="border-t border-stone-100"
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getTransactionTone(transaction.type)}`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-stone-600 whitespace-nowrap">
                            {formatTransactionDate(transaction.date)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-stone-900">
                              {transaction.description || transaction.category}
                            </div>
                            {transaction.description ? (
                              <div className="text-xs text-stone-400 mt-1">
                                {transaction.category}
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${
                              signedAmount >= 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {signedAmount >= 0 ? "+" : "-"}
                            {formatCurrency(Math.abs(signedAmount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-stone-50 border-t border-stone-200">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-4 text-right text-sm font-medium text-stone-500"
                      >
                        Total (current page)
                      </td>
                      <td
                        className={`px-6 py-4 text-right text-sm font-semibold ${pageTotal >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {pageTotal >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(pageTotal))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="md:hidden p-4 space-y-3 bg-stone-50/60">
                {paginatedTransactions.map((transaction) => {
                  const signedAmount = getSignedAmount(transaction);
                  const label = getTransactionLabel(transaction.type);

                  return (
                    <article
                      key={transaction.id}
                      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="font-medium text-stone-900 text-sm">
                            {transaction.description || transaction.category}
                          </div>
                          <div className="text-xs text-stone-400 mt-1">
                            {transaction.description
                              ? transaction.category
                              : "—"}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${getTransactionTone(transaction.type)}`}
                        >
                          {label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">
                            Date &amp; Time
                          </p>
                          <p className="text-stone-600">
                            {formatTransactionDate(transaction.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-wider text-stone-400 mb-1">
                            Amount
                          </p>
                          <p
                            className={`font-semibold ${signedAmount >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {signedAmount >= 0 ? "+" : "-"}
                            {formatCurrency(Math.abs(signedAmount))}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}

                <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
                  <span className="text-sm font-medium text-stone-500">
                    Total (current page)
                  </span>
                  <span
                    className={`text-sm font-semibold ${pageTotal >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {pageTotal >= 0 ? "+" : "-"}
                    {formatCurrency(Math.abs(pageTotal))}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 border-t border-stone-100 bg-white">
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(
                      safeCurrentPage * PAGE_SIZE,
                      filteredTransactions.length,
                    )}{" "}
                    of {filteredTransactions.length}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={safeCurrentPage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <span className="text-sm text-stone-500 px-2 text-center">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={safeCurrentPage === totalPages}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
