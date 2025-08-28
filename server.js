const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "supersecretkey"; // use process.env.SECRET in production

app.use(cors());
app.use(express.json());

// --- Database Setup ---
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB Error:", err.message);
  else console.log("Connected to SQLite DB");
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS habits(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    completed INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workouts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    minutes INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meals(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    calories INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS hydration(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    glasses INTEGER
  )`);
});

// --- Middleware: Auth ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Auth Routes ---
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users(name,email,password) VALUES(?,?,?)`,
    [name, email, hashed],
    function (err) {
      if (err) return res.status(400).json({ error: "Email already exists" });
      res.json({ message: "User created" });
    }
  );
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email=?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: "User not found" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, name: user.name });
  });
});

// --- Dashboard API ---
app.get("/api/dashboard", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split("T")[0];

  db.serialize(() => {
    db.get(
      `SELECT COUNT(*) as completed FROM habits WHERE user_id=? AND date=? AND completed=1`,
      [userId, today],
      (err, habits) => {
        db.get(
          `SELECT SUM(minutes) as minutes FROM workouts WHERE user_id=? AND date=?`,
          [userId, today],
          (err, workouts) => {
            db.get(
              `SELECT SUM(calories) as calories FROM meals WHERE user_id=? AND date=?`,
              [userId, today],
              (err, meals) => {
                db.get(
                  `SELECT SUM(glasses) as glasses FROM hydration WHERE user_id=? AND date=?`,
                  [userId, today],
                  (err, hydration) => {
                    res.json({
                      habits: habits?.completed || 0,
                      workouts: workouts?.minutes || 0,
                      calories: meals?.calories || 0,
                      hydration: hydration?.glasses || 0,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
