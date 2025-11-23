const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data.db');

let db;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
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
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_transactionId ON transactions(transactionId)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      color TEXT NOT NULL
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get all transactions
app.get('/api/transactions', (req, res) => {
  try {
    const results = db.exec('SELECT * FROM transactions ORDER BY date DESC');
    if (results.length === 0) {
      return res.json([]);
    }

    const columns = results[0].columns;
    const transactions = results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      obj.tags = obj.tags ? JSON.parse(obj.tags) : [];
      return obj;
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save transactions (upsert)
app.post('/api/transactions', (req, res) => {
  try {
    const transactions = req.body;

    for (const txn of transactions) {
      db.run(`
        INSERT OR REPLACE INTO transactions
        (id, transactionId, date, payee, amount, type, description, category, tags, account, balance, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
      ]);
    }

    saveDatabase();
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

    db.run(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, values);
    saveDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
  try {
    db.run('DELETE FROM transactions WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all transactions
app.delete('/api/transactions', (req, res) => {
  try {
    db.run('DELETE FROM transactions');
    saveDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check for duplicates
app.post('/api/transactions/check-duplicates', (req, res) => {
  try {
    const transactionIds = req.body;
    if (transactionIds.length === 0) {
      return res.json([]);
    }

    const placeholders = transactionIds.map(() => '?').join(',');
    const results = db.exec(
      `SELECT transactionId FROM transactions WHERE transactionId IN (${placeholders})`,
      transactionIds
    );

    if (results.length === 0) {
      return res.json([]);
    }

    res.json(results[0].values.map(r => r[0]));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories
app.get('/api/categories', (req, res) => {
  try {
    const results = db.exec('SELECT * FROM categories');
    if (results.length === 0) {
      return res.json([]);
    }

    const columns = results[0].columns;
    const categories = results[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save categories
app.post('/api/categories', (req, res) => {
  try {
    const categories = req.body;
    db.run('DELETE FROM categories');

    for (const cat of categories) {
      db.run('INSERT INTO categories (name, color) VALUES (?, ?)', [cat.name, cat.color]);
    }

    saveDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
