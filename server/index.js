const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'data.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transactionId TEXT,
    date TEXT NOT NULL,
    payee TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT,
    description TEXT,
    category TEXT,
    tags TEXT,
    account TEXT,
    balance REAL,
    reference TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_transactionId ON transactions(transactionId);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

  CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY,
    color TEXT NOT NULL
  );
`);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    const transactions = rows.map(row => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save transactions (upsert)
app.post('/api/transactions', (req, res) => {
  try {
    const transactions = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO transactions
      (id, transactionId, date, payee, amount, type, description, category, tags, account, balance, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((txns) => {
      for (const txn of txns) {
        insert.run(
          txn.id,
          txn.transactionId || null,
          txn.date,
          txn.payee,
          txn.amount,
          txn.type || null,
          txn.description || null,
          txn.category || null,
          JSON.stringify(txn.tags || []),
          txn.account || null,
          txn.balance || null,
          txn.reference || null
        );
      }
    });

    insertMany(transactions);
    res.json({ success: true, count: transactions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update transaction
app.patch('/api/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'tags') {
        fields.push('tags = ?');
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    values.push(id);

    db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all transactions
app.delete('/api/transactions', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions').run();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check for duplicates
app.post('/api/transactions/check-duplicates', (req, res) => {
  try {
    const transactionIds = req.body;
    const placeholders = transactionIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT transactionId FROM transactions WHERE transactionId IN (${placeholders})`
    ).all(...transactionIds);
    res.json(rows.map(r => r.transactionId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save categories
app.post('/api/categories', (req, res) => {
  try {
    const categories = req.body;
    db.prepare('DELETE FROM categories').run();

    const insert = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
    const insertMany = db.transaction((cats) => {
      for (const cat of cats) {
        insert.run(cat.name, cat.color);
      }
    });

    insertMany(categories);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
