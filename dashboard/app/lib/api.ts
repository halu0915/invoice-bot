const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3456";

export interface Invoice {
  id: number;
  image_path: string;
  date: string;
  vendor: string;
  tax_id: string | null;
  amount: number;
  tax_amount: number;
  pretax_amount: number;
  category: string;
  items: string;
  invoice_number: string;
  is_company: boolean;
  note: string;
  created_at: string;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  total_amount: number;
}

export interface Stats {
  total: { count: number; total_amount: number; total_tax: number };
  byCategory: CategoryBreakdown[];
  company: { count: number; total_amount: number; total_tax: number };
}

export const CATEGORIES = [
  "餐飲",
  "交通",
  "辦公用品",
  "水電費",
  "電信費",
  "日用品",
  "娛樂",
  "醫療",
  "其他",
] as const;

export type Category = (typeof CATEGORIES)[number];

// ---------- fetch helpers ----------

export async function fetchInvoices(params: {
  startDate: string;
  endDate: string;
  category?: string;
  isCompany?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Invoice[]> {
  const url = new URL(`${API_BASE}/api/invoices`);
  url.searchParams.set("startDate", params.startDate);
  url.searchParams.set("endDate", params.endDate);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.isCompany !== undefined)
    url.searchParams.set("isCompany", String(params.isCompany));
  url.searchParams.set("limit", String(params.limit ?? 200));
  url.searchParams.set("offset", String(params.offset ?? 0));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`fetchInvoices failed: ${res.status}`);
  const json = await res.json();
  return json.data as Invoice[];
}

export async function fetchStats(
  startDate: string,
  endDate: string,
): Promise<Stats> {
  const url = new URL(`${API_BASE}/api/stats`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`fetchStats failed: ${res.status}`);
  const json = await res.json();
  return json.data as Stats;
}

export async function deleteInvoice(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`deleteInvoice failed: ${res.status}`);
}
