// index.js

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 10000;

// ===== CORS Setup =====
// Replace with your actual Vercel frontend URL in production
app.use(cors({
  origin: "*" // e.g., "https://your-frontend.vercel.app"
}));

app.use(express.json());

// ===== SQLite Database =====
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("❌ SQLite error:", err.message);
  else console.log("✅ Connected to SQLite database");
});

// ===== Table Creation =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date TEXT,
      water INTEGER,
      sleep INTEGER,
      exercise INTEGER,
      study INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

// ===== Routes =====

// Health check
app.get("/", (req, res) => {
  res.send("🌿 Health Tracker API is running!");
});

// User Registration
app.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) {
        return res.status(409).json({ error: "Username already exists" });
      }
      res.json({ message: "Registered successfully" });
    }
  );
});

// User Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT id FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err || !row) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      res.json({ userId: row.id });
    }
  );
});

// Add or Update Daily Record
app.post("/update", (req, res) => {
  const { userId, date, water, sleep, exercise, study } = req.body;

  if (!userId || !date) {
    return res.status(400).json({ error: "Missing userId or date" });
  }

  db.get(
    `SELECT id FROM records WHERE user_id = ? AND date = ?`,
    [userId, date],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }

      if (row) {
        // Update existing record
        db.run(
          `UPDATE records SET water = ?, sleep = ?, exercise = ?, study = ? WHERE id = ?`,
          [water, sleep, exercise, study, row.id],
          function () {
            res.json({ message: "Updated record" });
          }
        );
      } else {
        // Insert new record
        db.run(
          `INSERT INTO records (user_id, date, water, sleep, exercise, study) VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, date, water, sleep, exercise, study],
          function () {
            res.json({ message: "Added record" });
          }
        );
      }
    }
  );
});

// Get Dashboard Data
app.get("/dashboard/:userId", (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT * FROM records WHERE user_id = ? ORDER BY date DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
