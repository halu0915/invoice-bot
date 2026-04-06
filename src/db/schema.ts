export const CREATE_INVOICES_TABLE = `
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT NOT NULL,
    date TEXT NOT NULL,
    vendor TEXT NOT NULL DEFAULT '',
    tax_id TEXT,
    amount REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    pretax_amount REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '其他',
    items TEXT NOT NULL DEFAULT '[]',
    invoice_number TEXT NOT NULL DEFAULT '',
    is_company INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`;

export const CREATE_INDEX_DATE = `
  CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)
`;

export const CREATE_INDEX_CATEGORY = `
  CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category)
`;

export const CREATE_INDEX_IS_COMPANY = `
  CREATE INDEX IF NOT EXISTS idx_invoices_is_company ON invoices(is_company)
`;
