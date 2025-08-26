const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: true,
  })
);

// Database
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB error:", err);
  else console.log("✅ Connected to SQLite");
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS health_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    sleep INTEGER,
    water INTEGER,
    exercise INTEGER,
    study INTEGER,
    UNIQUE(user_id, date)
  )`);
});

// -------- ROUTES --------

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashed],
    function (err) {
      if (err) return res.json({ success: false, message: "User already exists" });
      res.json({ success: true, message: "Registered successfully" });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user) return res.json({ success: false, message: "User not found" });
    if (!bcrypt.compareSync(password, user.password))
      return res.json({ success: false, message: "Wrong password" });

    req.session.userId = user.id;
    res.json({ success: true, message: "Login successful" });
  });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logged out" });
});

// Save health data
app.post("/save-data", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: "Not logged in" });
  const { date, sleep, water, exercise, study } = req.body;

  db.run(
    `INSERT INTO health_data (user_id, date, sleep, water, exercise, study)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
     sleep = excluded.sleep,
     water = excluded.water,
     exercise = excluded.exercise,
     study = excluded.study`,
    [req.session.userId, date, sleep, water, exercise, study],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true, message: "Data saved" });
    }
  );
});

// Load health data for a given date
app.get("/load-data/:date", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: "Not logged in" });
  db.get(
    "SELECT * FROM health_data WHERE user_id = ? AND date = ?",
    [req.session.userId, req.params.date],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, message: "DB error" });
      res.json(row || {});
    }
  );
});

app.listen(PORT, () => console.log(`🚀 Server running → http://localhost:${PORT}`));
