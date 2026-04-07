"use client";

interface PieData {
  category: string;
  count: number;
  total_amount: number;
}

interface CategoryPieProps {
  data: PieData[] | null;
}

const PIE_COLORS = [
  "#ef4444", // red-500
  "#3b82f6", // blue-500
  "#eab308", // yellow-500
  "#10b981", // emerald-500
  "#a855f7", // purple-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#6b7280", // gray-500
];

function fmt(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0 });
}

export default function CategoryPie({ data }: CategoryPieProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-48 w-48 animate-pulse rounded-full bg-gray-100" />
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="py-8 text-center text-gray-400">尚無分類資料</p>;
  }

  const total = data.reduce((sum, d) => sum + d.total_amount, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-gray-400">尚無分類資料</p>;
  }

  // Build conic-gradient stops
  const stops: string[] = [];
  let cumPct = 0;
  data.forEach((d, i) => {
    const pct = (d.total_amount / total) * 100;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    stops.push(`${color} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  });

  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      {/* Pie */}
      <div
        className="h-48 w-48 shrink-0 rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label="分類圓餅圖"
      />

      {/* Legend */}
      <div className="flex flex-col gap-2 text-sm">
        {data.map((d, i) => {
          const pct = ((d.total_amount / total) * 100).toFixed(1);
          const color = PIE_COLORS[i % PIE_COLORS.length];
          return (
            <div key={d.category} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-gray-700">{d.category}</span>
              <span className="font-mono text-gray-500">${fmt(d.total_amount)}</span>
              <span className="text-gray-400">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
