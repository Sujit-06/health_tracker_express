const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "supersecretkey"; // change for production

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database Setup
const db = new sqlite3.Database("./health.db", (err) => {
  if (err) console.error("DB Error:", err);
  else console.log("Connected to SQLite database");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    water_intake INTEGER,
    exercise_duration INTEGER,
    blood_sugar_level INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
});

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ================== AUTH ROUTES ==================
// Register
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  const hashed = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashed],
    function (err) {
      if (err) return res.status(400).json({ error: "User already exists" });
      res.json({ message: "User registered successfully" });
    }
  );
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
  });
});

// ================== RECORD ROUTES ==================
// Get all records
app.get("/api/records", authenticateToken, (req, res) => {
  db.all(
    "SELECT * FROM records WHERE user_id = ?",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Add record
app.post("/api/records", authenticateToken, (req, res) => {
  const { date, water_intake, exercise_duration, blood_sugar_level } = req.body;

  db.run(
    "INSERT INTO records (user_id, date, water_intake, exercise_duration, blood_sugar_level) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, date, water_intake, exercise_duration, blood_sugar_level],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Update record
app.put("/api/records/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { date, water_intake, exercise_duration, blood_sugar_level } = req.body;

  db.run(
    "UPDATE records SET date=?, water_intake=?, exercise_duration=?, blood_sugar_level=? WHERE id=? AND user_id=?",
    [date, water_intake, exercise_duration, blood_sugar_level, id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Record not found" });
      res.json({ message: "Record updated" });
    }
  );
});

// Delete record
app.delete("/api/records/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM records WHERE id=? AND user_id=?",
    [id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: "Record not found" });
      res.json({ message: "Record deleted" });
    }
  );
});

// ================== SERVER ==================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app; // for Vercel/Render
