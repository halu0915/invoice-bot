"use client";

import type { Stats } from "@/app/lib/api";

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });
}

interface StatsCardsProps {
  stats: Stats | null;
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
}

function Card({ label, value, sub, color }: CardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        label="總發票數量"
        value={fmt(stats.total.count)}
        sub="張發票"
        color="text-gray-900"
      />
      <Card
        label="總金額"
        value={`$${fmt(stats.total.total_amount)}`}
        sub={`稅額 $${fmt(stats.total.total_tax)}`}
        color="text-blue-600"
      />
      <Card
        label="公司進項金額"
        value={`$${fmt(stats.company.total_amount)}`}
        sub={`${fmt(stats.company.count)} 張`}
        color="text-emerald-600"
      />
      <Card
        label="可扣抵稅額"
        value={`$${fmt(stats.company.total_tax)}`}
        color="text-amber-600"
      />
    </div>
  );
}
