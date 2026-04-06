export interface Invoice {
  id: number;
  image_path: string;
  date: string;           // YYYY-MM-DD
  vendor: string;         // 商家名稱
  tax_id: string | null;  // 買方統編（有統編 = 公司進項）
  amount: number;         // 總金額（含稅）
  tax_amount: number;     // 稅額
  pretax_amount: number;  // 未稅金額
  category: string;       // 分類
  items: string;          // 品項明細 JSON
  invoice_number: string; // 發票號碼
  is_company: boolean;    // 是否為公司進項
  note: string;
  user_id: string;        // Telegram user ID
  user_name: string;      // Telegram display name
  created_at: string;
}

export interface OcrResult {
  date: string;
  vendor: string;
  tax_id: string | null;
  amount: number;
  tax_amount: number;
  pretax_amount: number;
  category: string;
  items: { name: string; quantity: number; price: number }[];
  invoice_number: string;
}

export type CategoryType =
  | '餐飲'
  | '交通'
  | '辦公用品'
  | '水電費'
  | '電信費'
  | '日用品'
  | '娛樂'
  | '醫療'
  | '其他';
