import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import fs from 'fs';
import { getInvoices, getStats, deleteInvoice, getDistinctUsers, updateInvoiceCategory, getInvoiceById } from '../db/index.js';

const app = new Hono();

app.use('/*', cors({ origin: '*' }));

// Get invoices list
app.get('/api/invoices', (c) => {
  const { startDate, endDate, category, isCompany, limit, offset, userId } = c.req.query();

  const invoices = getInvoices({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    category: category || undefined,
    isCompany: isCompany !== undefined ? isCompany === 'true' : undefined,
    userId: userId || undefined,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });

  return c.json({ ok: true, data: invoices });
});

// Get statistics
app.get('/api/stats', (c) => {
  const { startDate, endDate, userId } = c.req.query();

  if (!startDate || !endDate) {
    return c.json({ ok: false, error: 'startDate and endDate are required' }, 400);
  }

  const stats = getStats(startDate, endDate, userId || undefined);
  return c.json({ ok: true, data: stats });
});

// Get distinct users
app.get('/api/users', (c) => {
  const users = getDistinctUsers();
  return c.json({ ok: true, data: users });
});

// Update invoice category
app.patch('/api/invoices/:id/category', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ ok: false, error: 'Invalid ID' }, 400);
  }
  const body = await c.req.json<{ category: string }>();
  if (!body.category) {
    return c.json({ ok: false, error: 'category is required' }, 400);
  }
  const success = updateInvoiceCategory(id, body.category);
  if (success) {
    return c.json({ ok: true });
  }
  return c.json({ ok: false, error: 'Not found' }, 404);
});

// Delete invoice
app.delete('/api/invoices/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ ok: false, error: 'Invalid ID' }, 400);
  }

  const success = deleteInvoice(id);
  if (success) {
    return c.json({ ok: true });
  }
  return c.json({ ok: false, error: 'Not found' }, 404);
});

// Serve invoice image
app.get('/api/image/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ ok: false, error: 'Invalid ID' }, 400);
  }
  const invoice = getInvoiceById(id);
  if (!invoice || !invoice.image_path) {
    return c.json({ ok: false, error: 'Not found' }, 404);
  }
  try {
    const data = fs.readFileSync(invoice.image_path);
    const ext = invoice.image_path.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mime = mimeMap[ext] || 'image/jpeg';
    return new Response(data, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' } });
  } catch {
    return c.json({ ok: false, error: 'Image file not found' }, 404);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString(), version: 'v2-image' });
});

const port = parseInt(process.env.PORT || process.env.API_PORT || '3456', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`📊 API server running on http://localhost:${port}`);
});
