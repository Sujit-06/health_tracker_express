const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to SQLite DB");
});

// Tables
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, habit_name TEXT, streak INTEGER DEFAULT 0, completed_today INTEGER DEFAULT 0)");
  db.run("CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, workout_name TEXT, duration INTEGER, day TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, meal_name TEXT, quantity INTEGER, calories INTEGER, day TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS hydration (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, glasses INTEGER, day TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, hours INTEGER)");
});

// Register user
app.post("/register", (req, res) => {
  const { name } = req.body;
  db.run("INSERT INTO users (name) VALUES (?)", [name], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

// Add habit
app.post("/habits/:userId", (req, res) => {
  const { userId } = req.params;
  const { habit_name } = req.body;
  db.run("INSERT INTO habits (user_id, habit_name) VALUES (?, ?)", [userId, habit_name], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, habit_name });
  });
});

// Toggle habit (update streak)
app.post("/habits/:userId/toggle/:id", (req, res) => {
  const { userId, id } = req.params;
  const { completed } = req.body;

  if (completed) {
    db.run("UPDATE habits SET completed_today=1, streak=streak+1 WHERE user_id=? AND id=?", [userId, id], () => {
      res.json({ success: true });
    });
  } else {
    db.run("UPDATE habits SET completed_today=0 WHERE user_id=? AND id=?", [userId, id], () => {
      res.json({ success: true });
    });
  }
});

// Add workout
app.post("/workouts/:userId", (req, res) => {
  const { userId } = req.params;
  const { workout_name, duration } = req.body;
  const day = new Date().toLocaleString("en-US", { weekday: "short" });

  db.run("INSERT INTO workouts (user_id, workout_name, duration, day) VALUES (?, ?, ?, ?)", [userId, workout_name, duration, day], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, workout_name, duration, day });
  });
});

// Add meal
app.post("/meals/:userId", (req, res) => {
  const { userId } = req.params;
  const { meal_name, quantity } = req.body;
  const calories = quantity * 50; // Example: 1 quantity = 50 cal
  const day = new Date().toLocaleString("en-US", { weekday: "short" });

  db.run("INSERT INTO meals (user_id, meal_name, quantity, calories, day) VALUES (?, ?, ?, ?, ?)", [userId, meal_name, quantity, calories, day], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, meal_name, quantity, calories, day });
  });
});

// Add hydration
app.post("/hydration/:userId", (req, res) => {
  const { userId } = req.params;
  const { glasses } = req.body;
  const day = new Date().toLocaleString("en-US", { weekday: "short" });

  db.run("INSERT INTO hydration (user_id, glasses, day) VALUES (?, ?, ?)", [userId, glasses, day], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, glasses, day });
  });
});

// Add sleep
app.post("/sleep/:userId", (req, res) => {
  const { userId } = req.params;
  const { date, hours } = req.body;

  db.run("INSERT INTO sleep (user_id, date, hours) VALUES (?, ?, ?)", [userId, date, hours], function (err) {
    if (err) return res.json({ error: err.message });
    res.json({ id: this.lastID, date, hours });
  });
});

// Dashboard API
app.get("/dashboard/:userId", (req, res) => {
  const userId = req.params.userId;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let data = {
    labels,
    habits: [],
    habits_history: [],
    workouts: [],
    workouts_history: [],
    meals: [],
    meals_history: [],
    hydration: [],
    hydration_history: [],
    calories: [],
    sleep: [],
    sleep_history: []
  };

  // Habits
  db.all("SELECT * FROM habits WHERE user_id=?", [userId], (err, habits) => {
    if (err) return res.json({ error: err.message });
    data.habits_history = habits;
    data.habits = habits.map(h => ({
      id: h.id,
      habit_name: h.habit_name,
      streak: h.streak,
      completed_today: h.completed_today
    }));

    // Workouts
    db.all("SELECT * FROM workouts WHERE user_id=?", [userId], (err, workouts) => {
      if (err) return res.json({ error: err.message });
      data.workouts_history = workouts;
      data.workouts = labels.map(d => workouts.filter(r => r.day === d).length);

      // Meals
      db.all("SELECT * FROM meals WHERE user_id=?", [userId], (err, meals) => {
        if (err) return res.json({ error: err.message });
        data.meals_history = meals;
        data.meals = labels.map(d => meals.filter(r => r.day === d).length);
        data.calories = labels.map(d => meals.filter(r => r.day === d).reduce((sum, m) => sum + m.calories, 0));

        // Hydration
        db.all("SELECT * FROM hydration WHERE user_id=?", [userId], (err, hydration) => {
          if (err) return res.json({ error: err.message });
          data.hydration_history = hydration;
          data.hydration = labels.map(d => {
            const row = hydration.find(r => r.day === d);
            return row ? row.glasses : 0;
          });

          // Sleep
          db.all("SELECT * FROM sleep WHERE user_id=? ORDER BY date DESC", [userId], (err, sleep) => {
            if (err) return res.json({ error: err.message });
            data.sleep_history = sleep;
            data.sleep = sleep.map(r => ({ date: r.date, hours: r.hours }));

            res.json(data);
          });
        });
      });
    });
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
