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
  user_id: string;
  user_name: string;
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

export function getImageUrl(invoiceId: number): string {
  return `${API_BASE}/api/image/${invoiceId}`;
}

// ---------- fetch helpers ----------

export async function fetchInvoices(params: {
  startDate: string;
  endDate: string;
  category?: string;
  isCompany?: boolean;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<Invoice[]> {
  const url = new URL(`${API_BASE}/api/invoices`);
  url.searchParams.set("startDate", params.startDate);
  url.searchParams.set("endDate", params.endDate);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.isCompany !== undefined)
    url.searchParams.set("isCompany", String(params.isCompany));
  if (params.userId) url.searchParams.set("userId", params.userId);
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
  userId?: string,
): Promise<Stats> {
  const url = new URL(`${API_BASE}/api/stats`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  if (userId) url.searchParams.set("userId", userId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`fetchStats failed: ${res.status}`);
  const json = await res.json();
  return json.data as Stats;
}

export interface User {
  user_id: string;
  user_name: string;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/users`);
  if (!res.ok) throw new Error(`fetchUsers failed: ${res.status}`);
  const json = await res.json();
  return json.data as User[];
}

export async function updateCategory(id: number, category: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/invoices/${id}/category`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`updateCategory failed: ${res.status}`);
}

export async function deleteInvoice(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`deleteInvoice failed: ${res.status}`);
}

export function exportInvoicesToCsv(invoices: Invoice[], filename: string) {
  const BOM = "\uFEFF";
  const header = [
    "ID",
    "日期",
    "商家",
    "發票號碼",
    "金額",
    "稅額",
    "未稅金額",
    "分類",
    "買方統編",
    "公司進項",
    "品項",
    "建檔時間",
  ].join(",");

  const rows = invoices.map((inv) => {
    const items = (() => {
      try {
        const arr = JSON.parse(inv.items);
        return Array.isArray(arr)
          ? arr.map((i: { name: string }) => i.name).join("; ")
          : "";
      } catch {
        return "";
      }
    })();

    return [
      inv.id,
      inv.date,
      `"${inv.vendor.replace(/"/g, '""')}"`,
      inv.invoice_number,
      inv.amount,
      inv.tax_amount,
      inv.pretax_amount,
      inv.category,
      inv.tax_id ?? "",
      inv.is_company ? "是" : "否",
      `"${items.replace(/"/g, '""')}"`,
      inv.created_at,
    ].join(",");
  });

  const csv = BOM + header + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
