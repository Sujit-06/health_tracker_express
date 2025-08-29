const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- DATABASE ---
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB Error:", err.message);
  else console.log("Connected to SQLite DB");
});

// --- CREATE TABLES ---
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
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  exercise TEXT,
  sets INTEGER,
  reps INTEGER,
  duration INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  food TEXT,
  quantity INTEGER,
  calories INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS sleep (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  hours INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS hydration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date TEXT,
  glasses INTEGER
)`);

// --- REGISTER ---
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  db.run(
    `INSERT INTO users(username,password) VALUES(?,?)`,
    [username, password],
    function (err) {
      if (err) return res.json({ error: "User exists" });
      res.json({ message: "User registered", userId: this.lastID });
    }
  );
});

// --- LOGIN ---
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT * FROM users WHERE username=? AND password=?`,
    [username, password],
    (err, row) => {
      if (err || !row) return res.json({ error: "Invalid credentials" });
      res.json({ userId: row.id });
    }
  );
});

// --- DASHBOARD ---
app.get("/dashboard/:userId", async (req, res) => {
  const userId = req.params.userId;
  const result = {};

  // HABITS
  db.all(`SELECT * FROM habits WHERE user_id=?`, [userId], (err, habits) => {
    result.habits = habits || [];
    // WORKOUTS
    db.all(`SELECT * FROM workouts WHERE user_id=? ORDER BY date`, [userId], (err, workouts) => {
      result.workouts_history = workouts || [];
      result.workouts = workouts.map(w => 1); // simple count per entry
      // MEALS
      db.all(`SELECT * FROM meals WHERE user_id=? ORDER BY date`, [userId], (err, meals) => {
        result.meals_history = meals || [];
        result.meals = meals.map(m => 1); // simple count
        result.calories = meals.map(m => m.calories || 0);
        result.labels = meals.map(m => m.date);
        // SLEEP
        db.all(`SELECT * FROM sleep WHERE user_id=? ORDER BY date`, [userId], (err, sleep) => {
          result.sleep = sleep || [];
          // HYDRATION
          db.all(`SELECT * FROM hydration WHERE user_id=? ORDER BY date`, [userId], (err, hydration) => {
            result.hydration = hydration.map(h => h.glasses || 0);
            res.json(result);
          });
        });
      });
    });
  });
});

// --- HABITS ---
app.post("/habits/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { habit_name, date } = req.body;
  db.get(
    `SELECT * FROM habits WHERE user_id=? AND habit_name=? AND date=?`,
    [userId, habit_name, date],
    (err, row) => {
      if (row) return res.json({ error: "Habit exists for this date" });
      db.run(
        `INSERT INTO habits(user_id,habit_name,streak,completed_today,date) VALUES(?,?,0,0,?)`,
        [userId, habit_name, date],
        () => res.json({ success: true })
      );
    }
  );
});

app.post("/habits/:userId/toggle/:habitId", (req, res) => {
  const { habitId } = req.params;
  const { completed } = req.body;
  db.run(`UPDATE habits SET completed_today=? WHERE id=?`, [completed ? 1 : 0, habitId], () => res.json({ success: true }));
});

app.post("/habits/:userId/delete/:habitId", (req, res) => {
  const { habitId } = req.params;
  db.run(`DELETE FROM habits WHERE id=?`, [habitId], () => res.json({ success: true }));
});

// --- WORKOUTS ---
app.post("/workouts/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { date, exercise, sets, reps, duration } = req.body;
  db.run(
    `INSERT INTO workouts(user_id,date,exercise,sets,reps,duration) VALUES(?,?,?,?,?,?)`,
    [userId, date, exercise, sets, reps, duration],
    () => res.json({ success: true })
  );
});

// --- MEALS ---
app.post("/meals/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { date, food, quantity } = req.body;
  const calories = Math.round(quantity * 50);
  db.run(
    `INSERT INTO meals(user_id,date,food,quantity,calories) VALUES(?,?,?,?,?)`,
    [userId, date, food, quantity, calories],
    () => res.json({ success: true })
  );
});

// --- SLEEP ---
app.post("/sleep/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { date, hours } = req.body;
  db.run(`INSERT INTO sleep(user_id,date,hours) VALUES(?,?,?)`, [userId, date, hours], () => res.json({ success: true }));
});

// --- HYDRATION ---
app.post("/hydration/:userId/add", (req, res) => {
  const { userId } = req.params;
  const { glasses } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  db.get(`SELECT * FROM hydration WHERE user_id=? AND date=?`, [userId, today], (err, row) => {
    if (row) {
      db.run(`UPDATE hydration SET glasses=glasses+? WHERE id=?`, [glasses, row.id], () => res.json({ success: true }));
    } else {
      db.run(`INSERT INTO hydration(user_id,date,glasses) VALUES(?,?,?)`, [userId, today, glasses], () => res.json({ success: true }));
    }
  });
});

app.post("/hydration/:userId/reset", (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().slice(0, 10);
  db.run(`UPDATE hydration SET glasses=0 WHERE user_id=? AND date=?`, [userId, today], () => res.json({ success: true }));
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
