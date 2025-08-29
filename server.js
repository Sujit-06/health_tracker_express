const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Connect SQLite
const db = new sqlite3.Database("./healthtracker.db", (err) => {
  if (err) console.error("DB Error:", err.message);
  else console.log("Connected to SQLite database");
});

// Create Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    habit_name TEXT,
    streak INTEGER DEFAULT 0,
    completed_today INTEGER DEFAULT 0,
    date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    exercise TEXT,
    day TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    meal TEXT,
    calories INTEGER,
    day TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    hours INTEGER,
    date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS hydration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    glasses INTEGER,
    day TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ---------- Auth Routes ----------
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, password],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ userId: this.lastID });
    }
  );
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username, password],
    (err, row) => {
      if (err || !row) return res.status(401).json({ error: "Invalid login" });
      res.json({ userId: row.id });
    }
  );
});

// ---------- Add Data ----------
app.post("/api/habits/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { habit_name } = req.body;
  const date = new Date().toISOString().split("T")[0];
  db.run(
    "INSERT INTO habits (user_id, habit_name, streak, completed_today, date) VALUES (?, ?, 0, 0, ?)",
    [userId, habit_name, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, habit_name });
    }
  );
});

app.post("/api/workouts/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { exercise } = req.body;
  const day = new Date().toISOString().split("T")[0];
  db.run(
    "INSERT INTO workouts (user_id, exercise, day) VALUES (?, ?, ?)",
    [userId, exercise, day],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, exercise });
    }
  );
});

app.post("/api/meals/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { meal, calories } = req.body;
  const day = new Date().toISOString().split("T")[0];
  db.run(
    "INSERT INTO meals (user_id, meal, calories, day) VALUES (?, ?, ?, ?)",
    [userId, meal, calories, day],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, meal, calories });
    }
  );
});

app.post("/api/sleep/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { hours } = req.body;
  const date = new Date().toISOString().split("T")[0];
  db.run(
    "INSERT INTO sleep (user_id, hours, date) VALUES (?, ?, ?)",
    [userId, hours, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, hours });
    }
  );
});

app.post("/api/hydration/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { glasses } = req.body;
  const day = new Date().toISOString().split("T")[0];
  db.run(
    "INSERT INTO hydration (user_id, glasses, day) VALUES (?, ?, ?)",
    [userId, glasses, day],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, glasses });
    }
  );
});

// ---------- Dashboard ----------
app.get("/api/dashboard/:userId", (req, res) => {
  const { userId } = req.params;
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const getWeekday = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" });
    } catch {
      return null;
    }
  };

  const queries = {
    habits: `SELECT * FROM habits WHERE user_id=? ORDER BY date DESC LIMIT 20`,
    workouts: `SELECT * FROM workouts WHERE user_id=? ORDER BY day DESC LIMIT 20`,
    meals: `SELECT * FROM meals WHERE user_id=? ORDER BY day DESC LIMIT 20`,
    sleep: `SELECT * FROM sleep WHERE user_id=? ORDER BY date DESC LIMIT 20`,
    hydration: `SELECT * FROM hydration WHERE user_id=? ORDER BY day DESC LIMIT 20`,
  };

  const data = {};
  let completed = 0;

  for (const [key, sql] of Object.entries(queries)) {
    db.all(sql, [userId], (err, rows) => {
      if (err) rows = [];

      if (key === "workouts") {
        const countByDay = {};
        rows.forEach(r => {
          const wd = getWeekday(r.day);
          if (wd) countByDay[wd] = (countByDay[wd] || 0) + 1;
        });
        data.workouts = labels.map(d => countByDay[d] || 0);
        data.workouts_history = rows;
      } 
      else if (key === "meals") {
        const calByDay = {};
        rows.forEach(r => {
          const wd = getWeekday(r.day);
          if (wd) calByDay[wd] = (calByDay[wd] || 0) + (r.calories || 0);
        });
        data.calories = labels.map(d => calByDay[d] || 0);
        data.meals_history = rows;
      } 
      else if (key === "hydration") {
        const hydByDay = {};
        rows.forEach(r => {
          const wd = getWeekday(r.day);
          if (wd) hydByDay[wd] = (hydByDay[wd] || 0) + (r.glasses || 0);
        });
        data.hydration = labels.map(d => hydByDay[d] || 0);
        data.hydration_history = rows;
      } 
      else if (key === "habits") {
        data.habits = rows;
      } 
      else if (key === "sleep") {
        data.sleep = rows;
      }

      completed++;
      if (completed === Object.keys(queries).length) {
        res.json(data);
      }
    });
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
