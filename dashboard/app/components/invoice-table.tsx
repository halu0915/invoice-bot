"use client";

import { useState, useCallback } from "react";
import type { Invoice } from "@/app/lib/api";
import { CATEGORIES, deleteInvoice, updateCategory } from "@/app/lib/api";

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });
}

interface InvoiceTableProps {
  invoices: Invoice[] | null;
  onDeleted: () => void;
}

export default function InvoiceTable({
  invoices,
  onDeleted,
}: InvoiceTableProps) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [companyOnly, setCompanyOnly] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("確認刪除此筆發票？")) return;
      setDeleting(id);
      try {
        await deleteInvoice(id);
        onDeleted();
      } catch (err) {
        console.error(err);
        alert("刪除失敗");
      } finally {
        setDeleting(null);
      }
    },
    [onDeleted],
  );

  const filtered = invoices?.filter((inv) => {
    if (categoryFilter && inv.category !== categoryFilter) return false;
    if (companyOnly && !inv.is_company) return false;
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="cat-filter" className="text-sm text-gray-600">
            分類篩選
          </label>
          <select
            id="cat-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">全部</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <span>僅公司進項</span>
          <button
            type="button"
            role="switch"
            aria-checked={companyOnly}
            onClick={() => setCompanyOnly((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              companyOnly ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                companyOnly ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>

        {filtered && (
          <span className="ml-auto text-sm text-gray-400">
            {filtered.length} 筆
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">商家</th>
              <th className="px-4 py-3 text-right">金額</th>
              <th className="px-4 py-3">分類</th>
              <th className="px-4 py-3">上傳者</th>
              <th className="px-4 py-3 text-center">公司進項</th>
              <th className="px-4 py-3 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {!filtered && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  載入中...
                </td>
              </tr>
            )}
            {filtered && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  無符合條件的發票
                </td>
              </tr>
            )}
            {filtered?.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-gray-50 transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-mono text-gray-400">{inv.id}</td>
                <td className="px-4 py-3 whitespace-nowrap">{inv.date}</td>
                <td className="px-4 py-3 max-w-[200px] truncate" title={inv.vendor}>
                  {inv.vendor}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  ${fmt(inv.amount)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={inv.category}
                    onChange={async (e) => {
                      try {
                        await updateCategory(inv.id, e.target.value);
                        onDeleted();
                      } catch {
                        alert("更新分類失敗");
                      }
                    }}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 border-none cursor-pointer hover:bg-gray-200"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {inv.user_name || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {inv.is_company ? (
                    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      公司
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    disabled={deleting === inv.id}
                    onClick={() => handleDelete(inv.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === inv.id ? "刪除中..." : "刪除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
