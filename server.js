const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: "*" // you can replace "*" with your frontend URL
}));
app.use(express.json());

// ==== SQLite DB ====
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite database");
});

// Create tables if not exists
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  water INTEGER,
  sleep INTEGER,
  exercise INTEGER,
  study INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// ==== Routes ====

// Root
app.get("/", (req, res) => {
  res.send("Health Tracker API is running!");
});

// Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const query = `INSERT INTO users(username, password) VALUES (?, ?)`;
  db.run(query, [username, password], function(err){
    if(err) res.json({ error: "Username already exists" });
    else res.json({ message: "Registered successfully", userId: this.lastID });
  });
});

// Login
app.post("/login", (req,res) => {
  const { username, password } = req.body;
  const query = `SELECT id FROM users WHERE username=? AND password=?`;
  db.get(query, [username, password], (err,row) => {
    if(err || !row) res.json({ error: "Invalid credentials" });
    else res.json({ userId: row.id });
  });
});

// Add/Update Daily Stats
app.post("/update", (req,res) => {
  const { userId, date, water, sleep, exercise, study } = req.body;
  const selectQuery = `SELECT id FROM records WHERE user_id=? AND date=?`;
  db.get(selectQuery, [userId, date], (err,row) => {
    if(err){
      res.json({ error: err.message });
    } else if(row){
      const updateQuery = `UPDATE records SET water=?, sleep=?, exercise=?, study=? WHERE id=?`;
      db.run(updateQuery, [water, sleep, exercise, study, row.id], () => {
        res.json({ message:"Updated record" });
      });
    } else {
      const insertQuery = `INSERT INTO records(user_id, date, water, sleep, exercise, study) VALUES(?,?,?,?,?,?)`;
      db.run(insertQuery, [userId, date, water, sleep, exercise, study], () => {
        res.json({ message:"Added record" });
      });
    }
  });
});

// Get dashboard / all records for a user
app.get("/dashboard/:userId", (req,res) => {
  const userId = req.params.userId;
  const query = `SELECT * FROM records WHERE user_id=? ORDER BY date DESC`;
  db.all(query, [userId], (err,rows) => {
    if(err) res.json({ error: err.message });
    else res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
