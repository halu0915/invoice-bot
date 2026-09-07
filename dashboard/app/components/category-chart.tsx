"use client";

import type { CategoryBreakdown } from "@/app/lib/api";

const COLORS: Record<string, string> = {
  餐飲: "bg-[#c05b4d]",
  交通: "bg-[#1f5c99]",
  辦公用品: "bg-[#b8860b]",
  水電費: "bg-[#2e7d5b]",
  電信費: "bg-[#5b5ea6]",
  日用品: "bg-[#a86b8c]",
  娛樂: "bg-[#c98a3d]",
  醫療: "bg-[#3a8ea5]",
  其他: "bg-[#7186a0]",
};

interface CategoryChartProps {
  data: CategoryBreakdown[] | null;
}

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="py-8 text-center text-gray-400">尚無分類資料</p>;
  }

  const max = Math.max(...data.map((d) => d.total_amount), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = (item.total_amount / max) * 100;
        const barColor = COLORS[item.category] ?? "bg-gray-400";
        return (
          <div key={item.category}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                {item.category}
                <span className="ml-2 text-gray-400">({item.count} 張)</span>
              </span>
              <span className="font-mono text-gray-600">
                ${fmt(item.total_amount)}
              </span>
            </div>
            <div className="h-5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
