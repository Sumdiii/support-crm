const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (replaces database)
let tickets = [];
let notes = {};
let ticketCounter = 0;

// Initialize with sample data for testing
function initializeSampleData() {
  const now = new Date().toISOString();
  tickets = [
    {
      id: 1,
      ticket_id: 'TKT-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      subject: 'Login Issue',
      description: 'Cannot login to account',
      status: 'Open',
      priority: 'High',
      created_at: now,
      updated_at: now
    },
    {
      id: 2,
      ticket_id: 'TKT-002',
      customer_name: 'Jane Smith',
      customer_email: 'jane@example.com',
      subject: 'Feature Request',
      description: 'Request dark mode',
      status: 'In Progress',
      priority: 'Medium',
      created_at: now,
      updated_at: now
    }
  ];
  ticketCounter = 2;
  notes['TKT-001'] = [
    { id: 1, ticket_id: 'TKT-001', note_text: 'User confirmed issue', author: 'Support Agent', created_at: now }
  ];
  notes['TKT-002'] = [];
}

// Initialize on startup
initializeSampleData();

function generateTicketId() {
  ticketCounter++;
  return `TKT-${String(ticketCounter).padStart(3, '0')}`;
}

// Create ticket
app.post('/api/tickets', (req, res) => {
  const { customer_name, customer_email, subject, description, priority } = req.body;
  if (!customer_name || !customer_email || !subject || !description) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  const ticket_id = generateTicketId();
  const now = new Date().toISOString();
  
  const newTicket = {
    id: tickets.length + 1,
    ticket_id,
    customer_name,
    customer_email,
    subject,
    description,
    status: 'Open',
    priority: priority || 'Medium',
    created_at: now,
    updated_at: now
  };
  
  tickets.push(newTicket);
  notes[ticket_id] = [];
  
  res.status(201).json({ ticket_id, created_at: now });
});

// Get all tickets (with filtering)
app.get('/api/tickets', (req, res) => {
  const { status, search, priority } = req.query;
  
  let filtered = tickets;
  
  if (status && status !== 'All') {
    filtered = filtered.filter(t => t.status === status);
  }
  
  if (priority && priority !== 'All') {
    filtered = filtered.filter(t => t.priority === priority);
  }
  
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(t => 
      t.customer_name.toLowerCase().includes(s) ||
      t.customer_email.toLowerCase().includes(s) ||
      t.ticket_id.toLowerCase().includes(s) ||
      t.subject.toLowerCase().includes(s)
    );
  }
  
  // Sort by newest first
  filtered.sort((a, b) => b.id - a.id);
  
  res.json(filtered);
});

// Get single ticket with notes
app.get('/api/tickets/:ticket_id', (req, res) => {
  const ticket = tickets.find(t => t.ticket_id === req.params.ticket_id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  
  const ticketNotes = notes[req.params.ticket_id] || [];
  res.json({ ...ticket, notes: ticketNotes });
});

// Update ticket or add note
app.put('/api/tickets/:ticket_id', (req, res) => {
  const { status, priority, note_text } = req.body;
  const ticket = tickets.find(t => t.ticket_id === req.params.ticket_id);
  
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  
  const now = new Date().toISOString();
  
  // Update ticket status/priority
  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  if (status || priority) ticket.updated_at = now;
  
  // Add note
  if (note_text) {
    if (!notes[req.params.ticket_id]) {
      notes[req.params.ticket_id] = [];
    }
    notes[req.params.ticket_id].push({
      id: notes[req.params.ticket_id].length + 1,
      ticket_id: req.params.ticket_id,
      note_text,
      author: 'Support Agent',
      created_at: now
    });
  }
  
  res.json({ success: true });
});

// Delete ticket
app.delete('/api/tickets/:ticket_id', (req, res) => {
  const index = tickets.findIndex(t => t.ticket_id === req.params.ticket_id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  
  tickets.splice(index, 1);
  delete notes[req.params.ticket_id];
  
  res.json({ success: true });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'Open').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const closed = tickets.filter(t => t.status === 'Closed').length;
  
  res.json({ total, open, inProgress, closed });
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ CRM Server running on http://localhost:${PORT}`);
});
