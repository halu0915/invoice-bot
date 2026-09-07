"use client";

import type { Stats } from "@/app/lib/api";

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });
}

interface StatsCardsProps {
  stats: Stats | null;
}

function Card({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  if (highlight) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[#10243e] bg-[#10243e] p-5 shadow-sm">
        <p className="text-[12px] font-medium tracking-wider text-[#a9c2dc]">
          {label}
        </p>
        <p className="num mt-2 text-[28px] font-black leading-none text-[#f5c26b]">
          {value}
        </p>
        {sub && <p className="mt-2 text-[12px] text-[#8fa8c4]">{sub}</p>}
        <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-[#f5c26b]/10" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#dfe4ea] bg-white p-5 shadow-sm">
      <p className="text-[12px] font-medium tracking-wider text-[#7186a0]">
        {label}
      </p>
      <p className="num mt-2 text-[28px] font-black leading-none text-[#16202e]">
        {value}
      </p>
      {sub && <p className="mt-2 text-[12px] text-[#96a5b8]">{sub}</p>}
    </div>
  );
}

export default function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[#e4eaf0]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        label="發票數量"
        value={fmt(stats.total.count)}
        sub="本期收錄張數"
      />
      <Card
        label="總金額"
        value={`$${fmt(stats.total.total_amount)}`}
        sub={`含稅額 $${fmt(stats.total.total_tax)}`}
      />
      <Card
        label="公司進項"
        value={`$${fmt(stats.company.total_amount)}`}
        sub={`${fmt(stats.company.count)} 張標記為進項`}
      />
      <Card
        label="可扣抵稅額"
        value={`$${fmt(stats.company.total_tax)}`}
        sub="申報時直接引用"
        highlight
      />
    </div>
  );
}
