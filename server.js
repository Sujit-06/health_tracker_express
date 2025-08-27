// server.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: "*" })); // Allow all origins, or restrict to frontend domain
app.use(express.json());

// ==== SQLite DB Connection ====
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("❌ DB connection error:", err.message);
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
  water INTEGER DEFAULT 0,
  sleep INTEGER DEFAULT 0,
  exercise INTEGER DEFAULT 0,
  study INTEGER DEFAULT 0,
  calories INTEGER DEFAULT 0,
  workouts INTEGER DEFAULT 0,
  meals INTEGER DEFAULT 0,
  mood TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// ==== Routes ====

// Root
app.get("/", (req, res) => {
  res.send("🚀 Health Tracker API is running!");
});

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  db.run(
    "INSERT INTO users(username, password) VALUES (?, ?)",
    [username, password],
    function (err) {
      if (err) return res.status(400).json({ error: "Username already exists" });
      res.json({ message: "✅ Registered successfully", userId: this.lastID });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT id FROM users WHERE username=? AND password=?",
    [username, password],
    (err, row) => {
      if (err || !row) return res.status(401).json({ error: "Invalid credentials" });
      res.json({ message: "✅ Login successful", userId: row.id });
    }
  );
});

// Add / Update Daily Stats
app.post("/update", (req, res) => {
  const { userId, date, water, sleep, exercise, study, calories, workouts, meals, mood } = req.body;

  db.get("SELECT id FROM records WHERE user_id=? AND date=?", [userId, date], (err, row) => {
    if (row) {
      // Update existing record
      db.run(
        `UPDATE records 
         SET water=?, sleep=?, exercise=?, study=?, calories=?, workouts=?, meals=?, mood=? 
         WHERE id=?`,
        [water, sleep, exercise, study, calories, workouts, meals, mood, row.id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "✅ Record updated" });
        }
      );
    } else {
      // Insert new record
      db.run(
        `INSERT INTO records(user_id, date, water, sleep, exercise, study, calories, workouts, meals, mood) 
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
        [userId, date, water, sleep, exercise, study, calories, workouts, meals, mood],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "✅ Record added" });
        }
      );
    }
  });
});

// Get Dashboard Data
app.get("/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all(
    "SELECT * FROM records WHERE user_id=? ORDER BY date DESC LIMIT 30",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Download Report (CSV)
app.get("/report/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all("SELECT * FROM records WHERE user_id=?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let csv = "date,water,sleep,exercise,study,calories,workouts,meals,mood\n";
    rows.forEach((r) => {
      csv += `${r.date},${r.water},${r.sleep},${r.exercise},${r.study},${r.calories},${r.workouts},${r.meals},${r.mood}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=report.csv");
    res.send(csv);
  });
});

// ==== Start Server ====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
