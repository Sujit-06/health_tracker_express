/**
 * server.js
 * Express + sqlite3 backend for Health Tracker
 *
 * Usage:
 * 1. npm install
 * 2. npm start
 *
 * NOTE: Deploy to Render or similar for persistent sqlite file.
 */

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "health_tracker.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*"; // set to your frontend origin in production
const SALT_ROUNDS = 10;

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ---------- Utility: promisify sqlite3 operations ----------
function openDb(file) {
  return new sqlite3.Database(file, (err) => {
    if (err) {
      console.error("Failed to open DB:", err.message);
    } else {
      console.log("Opened SQLite DB:", file);
    }
  });
}
const db = openDb(DB_FILE);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ---------- Create tables if not exists ----------
async function initDb() {
  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    water INTEGER DEFAULT 0,
    sleep REAL DEFAULT 0,
    exercise INTEGER DEFAULT 0,
    study INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    meals INTEGER DEFAULT 0,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, date)
  );`);

  console.log("Tables ensured.");
}
initDb().catch((e) => console.error("DB init error", e));

// ---------- Routes ----------

// Root
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Health Tracker API is running" });
});

// Register
// body: { username, password, full_name(optional) }
app.post("/register", async (req, res) => {
  try {
    const { username, password, full_name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const sql = `INSERT INTO users (username, password, full_name) VALUES (?, ?, ?)`;
    await runAsync(sql, [username, hashed, full_name || null]);
    return res.json({ message: "Registered successfully" });
  } catch (err) {
    if (err && err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Login
// body: { username, password }
// returns: { userId, username, full_name }
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "username and password required" });

    const user = await getAsync(`SELECT id, username, password, full_name FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({ userId: user.id, username: user.username, full_name: user.full_name });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create or update daily stats record
// body: { userId, date (YYYY-MM-DD), water, sleep, exercise, study, calories, meals }
app.post("/update", async (req, res) => {
  try {
    const { userId, date, water = 0, sleep = 0, exercise = 0, study = 0, calories = 0, meals = 0 } = req.body;
    if (!userId || !date) return res.status(400).json({ error: "userId and date required" });

    const existing = await getAsync(`SELECT id FROM records WHERE user_id = ? AND date = ?`, [userId, date]);

    if (existing) {
      const sql = `UPDATE records SET water = ?, sleep = ?, exercise = ?, study = ?, calories = ?, meals = ? WHERE id = ?`;
      await runAsync(sql, [water, sleep, exercise, study, calories, meals, existing.id]);
      return res.json({ message: "Updated record" });
    } else {
      const sql = `INSERT INTO records (user_id, date, water, sleep, exercise, study, calories, meals) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const result = await runAsync(sql, [userId, date, water, sleep, exercise, study, calories, meals]);
      return res.json({ message: "Added record", recordId: result.lastID });
    }
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get dashboard / all records for a user
// GET /dashboard/:userId
app.get("/dashboard/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });

    const rows = await allAsync(`SELECT * FROM records WHERE user_id = ? ORDER BY date DESC`, [userId]);
    return res.json(rows);
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get single record by user/date
// GET /record/:userId/:date  (date format YYYY-MM-DD)
app.get("/record/:userId/:date", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const date = req.params.date;
    if (isNaN(userId) || !date) return res.status(400).json({ error: "Invalid params" });

    const row = await getAsync(`SELECT * FROM records WHERE user_id = ? AND date = ?`, [userId, date]);
    return res.json(row || {});
  } catch (err) {
    console.error("Get record error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a record (optional)
// DELETE /record/:id
app.delete("/record/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    await runAsync(`DELETE FROM records WHERE id = ?`, [id]);
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (PORT=${PORT})`);
});
