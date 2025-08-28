import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

// App setup
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.sqlite");

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("DB Connection Error:", err.message);
  else console.log("Connected to SQLite database");
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      habit_name TEXT,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      workout_name TEXT,
      duration INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      meal_name TEXT,
      calories INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sleep (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      hours INTEGER,
      date TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mood (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      mood TEXT,
      date TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
});

// -------------------- Routes --------------------

// Signup
app.post("/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: "Missing fields" });

  const query = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
  db.run(query, [username, email, password], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: "User created", userId: this.lastID });
  });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;
  db.get(query, [email, password], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ message: "Login successful", user: row });
  });
});

// Get dashboard data
app.get("/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const data = {};

  // Fetch habits
  db.all(`SELECT * FROM habits WHERE user_id = ?`, [userId], (err, habits) => {
    if (err) return res.status(500).json({ error: err.message });
    data.habits = habits || [];

    // Fetch workouts
    db.all(`SELECT * FROM workouts WHERE user_id = ?`, [userId], (err, workouts) => {
      if (err) return res.status(500).json({ error: err.message });
      data.workouts = workouts || [];

      // Fetch meals
      db.all(`SELECT * FROM meals WHERE user_id = ?`, [userId], (err, meals) => {
        if (err) return res.status(500).json({ error: err.message });
        data.meals = meals || [];

        // Fetch sleep
        db.all(`SELECT * FROM sleep WHERE user_id = ?`, [userId], (err, sleep) => {
          if (err) return res.status(500).json({ error: err.message });
          data.sleep = sleep || [];

          // Fetch mood
          db.all(`SELECT * FROM mood WHERE user_id = ?`, [userId], (err, mood) => {
            if (err) return res.status(500).json({ error: err.message });
            data.mood = mood || [];
            res.json(data);
          });
        });
      });
    });
  });
});

// Add habit
app.post("/habit", (req, res) => {
  const { userId, habitName } = req.body;
  if (!userId || !habitName) return res.status(400).json({ error: "Missing fields" });
  db.run(`INSERT INTO habits (user_id, habit_name) VALUES (?, ?)`, [userId, habitName], function(err){
    if(err) return res.status(500).json({ error: err.message });
    res.json({ message: "Habit added", id: this.lastID });
  });
});

// Mark habit completed
app.put("/habit/:id/complete", (req, res) => {
  const habitId = req.params.id;
  db.run(`UPDATE habits SET completed = 1 WHERE id = ?`, [habitId], function(err){
    if(err) return res.status(500).json({ error: err.message });
    res.json({ message: "Habit marked completed" });
  });
});

// -------------------- Start Server --------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
