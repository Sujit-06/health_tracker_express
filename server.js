const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 10000;

// ========================
// Middleware
// ========================
app.use(cors({
  origin: 'https://health-trackerdes.vercel.app' // Or your Vercel frontend URL: 'https://your-frontend.vercel.app'
}));
app.use(express.json());

// ========================
// Database setup
// ========================
const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to SQLite', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create users table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    water INTEGER DEFAULT 0,
    sleep INTEGER DEFAULT 0,
    exercise INTEGER DEFAULT 0,
    study INTEGER DEFAULT 0
  )
`);

// ========================
// Root route
// ========================
app.get('/', (req, res) => {
  res.send('Health Tracker API is running!');
});

// ========================
// API Routes
// ========================

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], function(err) {
    if (err) return res.status(500).json({ error: 'User may already exist' });
    res.json({ message: 'User registered', userId: this.lastID });
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    res.json({ message: 'Login successful', userId: user.id });
  });
});

// Update daily stats
app.post('/update', (req, res) => {
  const { userId, water, sleep, exercise, study } = req.body;

  db.run(
    `UPDATE users SET water = ?, sleep = ?, exercise = ?, study = ? WHERE id = ?`,
    [water, sleep, exercise, study, userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      res.json({ message: 'Stats updated' });
    }
  );
});

// Get dashboard stats
app.get('/dashboard/:userId', (req, res) => {
  const userId = req.params.userId;

  db.get(`SELECT water, sleep, exercise, study FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// ========================
// Start server
// ========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Available at your primary URL ${process.env.RENDER_EXTERNAL_URL || 'Render URL'}`);
});
