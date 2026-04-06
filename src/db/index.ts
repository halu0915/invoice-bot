import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CREATE_INVOICES_TABLE,
  CREATE_INDEX_DATE,
  CREATE_INDEX_CATEGORY,
  CREATE_INDEX_IS_COMPANY,
} from './schema.js';
import type { Invoice } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/invoices.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(CREATE_INVOICES_TABLE);
    db.exec(CREATE_INDEX_DATE);
    db.exec(CREATE_INDEX_CATEGORY);
    db.exec(CREATE_INDEX_IS_COMPANY);
  }
  return db;
}

export function insertInvoice(data: Omit<Invoice, 'id' | 'created_at'>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO invoices (image_path, date, vendor, tax_id, amount, tax_amount, pretax_amount, category, items, invoice_number, is_company, note)
    VALUES (@image_path, @date, @vendor, @tax_id, @amount, @tax_amount, @pretax_amount, @category, @items, @invoice_number, @is_company, @note)
  `);
  const result = stmt.run({
    ...data,
    is_company: data.is_company ? 1 : 0,
  });
  return result.lastInsertRowid as number;
}

export function getInvoices(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  isCompany?: boolean;
  limit?: number;
  offset?: number;
}): Invoice[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.startDate) {
    conditions.push('date >= @startDate');
    params.startDate = filters.startDate;
  }
  if (filters?.endDate) {
    conditions.push('date <= @endDate');
    params.endDate = filters.endDate;
  }
  if (filters?.category) {
    conditions.push('category = @category');
    params.category = filters.category;
  }
  if (filters?.isCompany !== undefined) {
    conditions.push('is_company = @isCompany');
    params.isCompany = filters.isCompany ? 1 : 0;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const stmt = db.prepare(`
    SELECT *, CASE WHEN is_company = 1 THEN 1 ELSE 0 END as is_company
    FROM invoices ${where}
    ORDER BY date DESC
    LIMIT @limit OFFSET @offset
  `);

  const rows = stmt.all({ ...params, limit, offset }) as Invoice[];
  return rows.map((r) => ({ ...r, is_company: Boolean(r.is_company) }));
}

export function getStats(startDate: string, endDate: string) {
  const db = getDb();

  const totalStmt = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(tax_amount), 0) as total_tax
    FROM invoices
    WHERE date >= @startDate AND date <= @endDate
  `);

  const categoryStmt = db.prepare(`
    SELECT
      category,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total_amount
    FROM invoices
    WHERE date >= @startDate AND date <= @endDate
    GROUP BY category
    ORDER BY total_amount DESC
  `);

  const companyStmt = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total_amount,
      COALESCE(SUM(tax_amount), 0) as total_tax
    FROM invoices
    WHERE date >= @startDate AND date <= @endDate AND is_company = 1
  `);

  return {
    total: totalStmt.get({ startDate, endDate }) as { count: number; total_amount: number; total_tax: number },
    byCategory: categoryStmt.all({ startDate, endDate }) as { category: string; count: number; total_amount: number }[],
    company: companyStmt.get({ startDate, endDate }) as { count: number; total_amount: number; total_tax: number },
  };
}

export function deleteInvoice(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM invoices WHERE id = @id');
  const result = stmt.run({ id });
  return result.changes > 0;
}
