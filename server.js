import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Open SQLite database
const dbPromise = open({
  filename: './health_tracker.db',
  driver: sqlite3.Database
});

// Initialize tables
(async () => {
  const db = await dbPromise;

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      duration INTEGER
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      calories INTEGER
    );

    CREATE TABLE IF NOT EXISTS sleep (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      hours REAL,
      date TEXT
    );

    CREATE TABLE IF NOT EXISTS mood (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      mood TEXT,
      date TEXT
    );
  `);

  console.log('Database initialized');
})();

// --- AUTH ROUTES ---

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const db = await dbPromise;
    await db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, password]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: 'Email already exists.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const db = await dbPromise;
  const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }
});

// --- HABITS ROUTES ---
app.get('/habits/:userId', async (req, res) => {
  const db = await dbPromise;
  const habits = await db.all('SELECT * FROM habits WHERE user_id = ?', [req.params.userId]);
  res.json(habits);
});

app.post('/habits', async (req, res) => {
  const { userId, name } = req.body;
  const db = await dbPromise;
  await db.run('INSERT INTO habits (user_id, name) VALUES (?, ?)', [userId, name]);
  res.json({ success: true });
});

app.post('/habits/complete', async (req, res) => {
  const { habitId, completed } = req.body;
  const db = await dbPromise;
  await db.run('UPDATE habits SET completed = ? WHERE id = ?', [completed ? 1 : 0, habitId]);
  res.json({ success: true });
});

// --- WORKOUTS ROUTES ---
app.get('/workouts/:userId', async (req, res) => {
  const db = await dbPromise;
  const workouts = await db.all('SELECT * FROM workouts WHERE user_id = ?', [req.params.userId]);
  res.json(workouts);
});

app.post('/workouts', async (req, res) => {
  const { userId, type, duration } = req.body;
  const db = await dbPromise;
  await db.run('INSERT INTO workouts (user_id, type, duration) VALUES (?, ?, ?)', [userId, type, duration]);
  res.json({ success: true });
});

// --- SLEEP ROUTES ---
app.get('/sleep/:userId', async (req, res) => {
  const db = await dbPromise;
  const sleepData = await db.all('SELECT * FROM sleep WHERE user_id = ?', [req.params.userId]);
  res.json(sleepData);
});

app.post('/sleep', async (req, res) => {
  const { userId, hours, date } = req.body;
  const db = await dbPromise;
  await db.run('INSERT INTO sleep (user_id, hours, date) VALUES (?, ?, ?)', [userId, hours, date]);
  res.json({ success: true });
});

// --- MOOD ROUTES ---
app.get('/mood/:userId', async (req, res) => {
  const db = await dbPromise;
  const moodData = await db.all('SELECT * FROM mood WHERE user_id = ?', [req.params.userId]);
  res.json(moodData);
});

app.post('/mood', async (req, res) => {
  const { userId, mood, date } = req.body;
  const db = await dbPromise;
  await db.run('INSERT INTO mood (user_id, mood, date) VALUES (?, ?, ?)', [userId, mood, date]);
  res.json({ success: true });
});

// --- MEALS ROUTES ---
app.get('/meals/:userId', async (req, res) => {
  const db = await dbPromise;
  const meals = await db.all('SELECT * FROM meals WHERE user_id = ?', [req.params.userId]);
  res.json(meals);
});

app.post('/meals', async (req, res) => {
  const { userId, name, calories } = req.body;
  const db = await dbPromise;
  await db.run('INSERT INTO meals (user_id, name, calories) VALUES (?, ?, ?)', [userId, name, calories]);
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
