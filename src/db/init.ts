import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
const uploadDir = path.join(dataDir, 'uploads');

// Create directories
fs.mkdirSync(uploadDir, { recursive: true });

// Initialize database
const db = getDb();
console.log('✅ Database initialized at data/invoices.db');
console.log('✅ Upload directory created at data/uploads/');

db.close();
