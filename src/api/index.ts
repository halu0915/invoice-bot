import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { getInvoices, getStats, deleteInvoice } from '../db/index.js';

const app = new Hono();

app.use('/*', cors({ origin: '*' }));

// Get invoices list
app.get('/api/invoices', (c) => {
  const { startDate, endDate, category, isCompany, limit, offset } = c.req.query();

  const invoices = getInvoices({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    category: category || undefined,
    isCompany: isCompany !== undefined ? isCompany === 'true' : undefined,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });

  return c.json({ ok: true, data: invoices });
});

// Get statistics
app.get('/api/stats', (c) => {
  const { startDate, endDate } = c.req.query();

  if (!startDate || !endDate) {
    return c.json({ ok: false, error: 'startDate and endDate are required' }, 400);
  }

  const stats = getStats(startDate, endDate);
  return c.json({ ok: true, data: stats });
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

// Health check
app.get('/api/health', (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

const port = parseInt(process.env.PORT || process.env.API_PORT || '3456', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`📊 API server running on http://localhost:${port}`);
});
