import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'transactions.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/transactions', (_req, res) => {
  const rows = db.prepare('SELECT data FROM transactions').all() as { data: string }[];
  res.json(rows.map(r => JSON.parse(r.data)));
});

// check-duplicates must come before /:id to avoid being caught as an id
app.post('/api/transactions/check-duplicates', (req, res) => {
  const ids: string[] = req.body;
  const existing = ids.filter(id =>
    db.prepare('SELECT 1 FROM transactions WHERE id = ?').get(id)
  );
  res.json(existing);
});

app.post('/api/transactions', (req, res) => {
  const transactions: Array<{ id: string }> = req.body;
  const insert = db.prepare('INSERT OR REPLACE INTO transactions (id, data) VALUES (?, ?)');
  db.transaction(() => {
    db.prepare('DELETE FROM transactions').run();
    for (const t of transactions) insert.run(t.id, JSON.stringify(t));
  })();
  res.json({ ok: true });
});

app.patch('/api/transactions/:id', (req, res) => {
  const row = db.prepare('SELECT data FROM transactions WHERE id = ?').get(req.params.id) as { data: string } | undefined;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const updated = { ...JSON.parse(row.data), ...req.body };
  db.prepare('UPDATE transactions SET data = ? WHERE id = ?').run(JSON.stringify(updated), req.params.id);
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/transactions', (_req, res) => {
  db.prepare('DELETE FROM transactions').run();
  res.json({ ok: true });
});

app.get('/api/categories', (_req, res) => {
  const row = db.prepare('SELECT data FROM categories WHERE id = 1').get() as { data: string } | undefined;
  res.json(row ? JSON.parse(row.data) : []);
});

app.post('/api/categories', (req, res) => {
  db.prepare('INSERT OR REPLACE INTO categories (id, data) VALUES (1, ?)').run(JSON.stringify(req.body));
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
