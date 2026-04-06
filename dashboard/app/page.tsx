"use client";

import { useState, useEffect, useCallback } from "react";
import StatsCards from "@/app/components/stats-cards";
import CategoryChart from "@/app/components/category-chart";
import InvoiceTable from "@/app/components/invoice-table";
import { fetchInvoices, fetchStats } from "@/app/lib/api";
import type { Invoice, Stats } from "@/app/lib/api";

function getMonthRange(year: number, month: number) {
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
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<Stats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    try {
      setError(null);
      const [s, inv] = await Promise.all([
        fetchStats(start, end),
        fetchInvoices({ startDate: start, endDate: end }),
      ]);
      setStats(s);
      setInvoices(inv);
    } catch (err) {
      console.error(err);
      setError("無法連線到 API，請確認後端服務是否正常運作。");
    }
  }, [year, month]);

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
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
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

        {/* Month picker */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            &larr; 上月
          </button>
          <span className="min-w-[100px] text-center text-sm font-semibold text-gray-800">
            {year} 年 {MONTH_LABELS[month]}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            下月 &rarr;
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
