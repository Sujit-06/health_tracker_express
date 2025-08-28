const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: "*" })); // Change "*" to your Vercel frontend URL if you want restriction
app.use(express.json());

// ==== SQLite DB ====
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error(err.message);
  else console.log("✅ Connected to SQLite database");
});

// ==== Create Tables ====
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  habits TEXT DEFAULT '',
  workouts TEXT DEFAULT '',
  meals TEXT DEFAULT '',
  sleep TEXT DEFAULT '',
  mood TEXT DEFAULT '',
  friends TEXT DEFAULT '',
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// ==== Routes ====

// Root
app.get("/", (req, res) => {
  res.send("🚀 Health Tracker API is running on Render!");
});

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const query = `INSERT INTO users(username, password) VALUES (?, ?)`;
  db.run(query, [username, password], function (err) {
    if (err) res.json({ error: "Username already exists" });
    else res.json({ message: "Registered successfully", userId: this.lastID });
  });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT id FROM users WHERE username=? AND password=?`;
  db.get(query, [username, password], (err, row) => {
    if (err || !row) res.json({ error: "Invalid credentials" });
    else res.json({ userId: row.id });
  });
});

// Save section data (Habits, Workouts, Meals, Sleep, Mood, Friends)
app.post("/save/:section", (req, res) => {
  const { section } = req.params;
  const { userId, date, data } = req.body;

  if (!["habits", "workouts", "meals", "sleep", "mood", "friends"].includes(section)) {
    return res.json({ error: "Invalid section" });
  }

  const selectQuery = `SELECT id FROM records WHERE user_id=? AND date=?`;
  db.get(selectQuery, [userId, date], (err, row) => {
    if (err) return res.json({ error: err.message });

    if (row) {
      // Update record
      const updateQuery = `UPDATE records SET ${section}=? WHERE id=?`;
      db.run(updateQuery, [JSON.stringify(data), row.id], (err2) => {
        if (err2) res.json({ error: err2.message });
        else res.json({ message: `${section} updated` });
      });
    } else {
      // Insert new record
      const insertQuery = `INSERT INTO records(user_id, date, ${section}) VALUES (?, ?, ?)`;
      db.run(insertQuery, [userId, date, JSON.stringify(data)], (err2) => {
        if (err2) res.json({ error: err2.message });
        else res.json({ message: `${section} saved` });
      });
    }
  });
});

// Get dashboard records for a user
app.get("/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  const query = `SELECT * FROM records WHERE user_id=? ORDER BY date DESC`;
  db.all(query, [userId], (err, rows) => {
    if (err) res.json({ error: err.message });
    else res.json(rows);
  });
});

// Get today's record
app.get("/today/:userId/:date", (req, res) => {
  const { userId, date } = req.params;
  const query = `SELECT * FROM records WHERE user_id=? AND date=?`;
  db.get(query, [userId, date], (err, row) => {
    if (err) res.json({ error: err.message });
    else res.json(row || {});
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
