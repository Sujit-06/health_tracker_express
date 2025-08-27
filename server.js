import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
app.use(cors());
app.use(express.json());

let db;

// ====================== DB INIT ======================
async function initDB() {
  db = await open({
    filename: "./health.db",
    driver: sqlite3.Database,
  });

  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  // Health data table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS health_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      entry TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  console.log("SQLite DB initialized ✅");
}

// ====================== AUTH ROUTES ======================

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    await db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed]
    );

    res.json({ success: true, message: "User registered!" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) return res.status(401).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== DATA ROUTES ======================

// Add health entry (habit, workout, meal, sleep, mood)
app.post("/api/data", async (req, res) => {
  try {
    const { user_id, type, entry } = req.body;
    await db.run(
      "INSERT INTO health_data (user_id, type, entry) VALUES (?, ?, ?)",
      [user_id, type, entry]
    );
    res.json({ success: true, message: "Entry added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all entries for a user
app.get("/api/data/:user_id", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM health_data WHERE user_id = ? ORDER BY created_at DESC",
      [req.params.user_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== SERVER ======================
const PORT = process.env.PORT || 5000;

initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
});
