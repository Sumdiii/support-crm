const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(path.join(__dirname, 'crm.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    priority TEXT NOT NULL DEFAULT 'Medium',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    note_text TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Support Agent',
    created_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(ticket_id)
  );
`);

function generateTicketId() {
  const last = db.prepare(`SELECT ticket_id FROM tickets ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'TKT-001';
  const num = parseInt(last.ticket_id.split('-')[1]) + 1;
  return `TKT-${String(num).padStart(3, '0')}`;
}

app.post('/api/tickets', (req, res) => {
  const { customer_name, customer_email, subject, description, priority } = req.body;
  if (!customer_name || !customer_email || !subject || !description) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const ticket_id = generateTicketId();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO tickets (ticket_id, customer_name, customer_email, subject, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Open', ?, ?, ?)`).run(ticket_id, customer_name, customer_email, subject, description, priority || 'Medium', now, now);
  res.status(201).json({ ticket_id, created_at: now });
});

app.get('/api/tickets', (req, res) => {
  const { status, search, priority } = req.query;
  let query = `SELECT * FROM tickets WHERE 1=1`;
  const params = [];
  if (status && status !== 'All') { query += ` AND status = ?`; params.push(status); }
  if (priority && priority !== 'All') { query += ` AND priority = ?`; params.push(priority); }
  if (search) {
    query += ` AND (customer_name LIKE ? OR customer_email LIKE ? OR ticket_id LIKE ? OR subject LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ` ORDER BY id DESC`;
  res.json(db.prepare(query).all(...params));
});

app.get('/api/tickets/:ticket_id', (req, res) => {
  const ticket = db.prepare(`SELECT * FROM tickets WHERE ticket_id = ?`).get(req.params.ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  const notes = db.prepare(`SELECT * FROM notes WHERE ticket_id = ? ORDER BY id ASC`).all(req.params.ticket_id);
  res.json({ ...ticket, notes });
});

app.put('/api/tickets/:ticket_id', (req, res) => {
  const { status, priority, note_text } = req.body;
  const ticket = db.prepare(`SELECT * FROM tickets WHERE ticket_id = ?`).get(req.params.ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  const now = new Date().toISOString();
  if (status || priority) {
    db.prepare(`UPDATE tickets SET status = ?, priority = ?, updated_at = ? WHERE ticket_id = ?`).run(status || ticket.status, priority || ticket.priority, now, req.params.ticket_id);
  }
  if (note_text) {
    db.prepare(`INSERT INTO notes (ticket_id, note_text, created_at) VALUES (?, ?, ?)`).run(req.params.ticket_id, note_text, now);
  }
  res.json({ success: true });
});

app.delete('/api/tickets/:ticket_id', (req, res) => {
  db.prepare(`DELETE FROM notes WHERE ticket_id = ?`).run(req.params.ticket_id);
  db.prepare(`DELETE FROM tickets WHERE ticket_id = ?`).run(req.params.ticket_id);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) as count FROM tickets`).get().count;
  const open = db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE status = 'Open'`).get().count;
  const inProgress = db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE status = 'In Progress'`).get().count;
  const closed = db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE status = 'Closed'`).get().count;
  res.json({ total, open, inProgress, closed });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ CRM Server running on http://localhost:${PORT}`);
});