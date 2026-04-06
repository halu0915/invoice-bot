"use client";

import { useState, useEffect, useCallback } from "react";
import StatsCards from "@/app/components/stats-cards";
import CategoryChart from "@/app/components/category-chart";
import InvoiceTable from "@/app/components/invoice-table";
import { fetchInvoices, fetchStats, fetchUsers, exportInvoicesToCsv } from "@/app/lib/api";
import type { Invoice, Stats, User } from "@/app/lib/api";

function getMonthRange(year: number, month: number) {
  if (month === 0) {
    // Full year
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

const MONTH_LABELS = [
  "",
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 = full year, -1 = custom range
  const [stats, setStats] = useState<Stats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customStart, setCustomStart] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [customEnd, setCustomEnd] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
  );

  // Load users once on mount
  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    let start: string, end: string;
    if (month === -1) {
      start = customStart;
      end = customEnd;
    } else {
      ({ start, end } = getMonthRange(year, month));
    }
    try {
      setError(null);
      const userId = selectedUserId || undefined;
      const [s, inv] = await Promise.all([
        fetchStats(start, end, userId),
        fetchInvoices({ startDate: start, endDate: end, userId }),
      ]);
      setStats(s);
      setInvoices(inv);
    } catch (err) {
      console.error(err);
      setError("無法連線到 API，請確認後端服務是否正常運作。");
    }
  }, [year, month, selectedUserId, customStart, customEnd]);

  // Fetch on mount and when month changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
    } else if (month === 1) {
      setMonth(0); // go to full year
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 0) {
      setYear((y) => y + 1);
    } else if (month === 12) {
      setMonth(0); // go to full year
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          發票管理面板
        </h1>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <option value="">全部使用者</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_name || u.user_id}
              </option>
            ))}
          </select>

          {month !== -1 && (
            <>
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                &larr;
              </button>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-800"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y} 年</option>
                ))}
              </select>
            </>
          )}

          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-800"
          >
            <option value={0}>全年度</option>
            {MONTH_LABELS.slice(1).map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
            <option value={-1}>自訂區間</option>
          </select>

          {month !== -1 && (
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              &rarr;
            </button>
          )}

          {month === -1 && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
              />
              <span className="text-sm text-gray-500">~</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800"
              />
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (invoices && invoices.length > 0) {
                const filename = month === -1
                  ? `發票_${customStart}_${customEnd}.csv`
                  : `發票_${year}${month === 0 ? "_全年度" : `-${String(month).padStart(2, "0")}`}.csv`;
                exportInvoicesToCsv(invoices, filename);
              }
            }}
            disabled={!invoices || invoices.length === 0}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下載 CSV
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <section className="mb-8">
        <StatsCards stats={stats} />
      </section>

      {/* Category chart */}
      <section className="mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            分類統計
          </h2>
          <CategoryChart data={stats?.byCategory ?? null} />
        </div>
      </section>

      {/* Invoice table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">
          發票明細
        </h2>
        <InvoiceTable invoices={invoices} onDeleted={loadData} />
      </section>
    </div>
  );
}
