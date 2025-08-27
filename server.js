const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: "*" // allow all, or replace with frontend URL
}));
app.use(express.json());

// ==== SQLite DB ====
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite database");
});

// Create tables
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
  db.run(`INSERT INTO users(username,password) VALUES (?,?)`, [username,password], function(err){
    if(err) res.json({error: "Username already exists"});
    else res.json({message: "Registered successfully"});
  });
});

// Login
app.post("/login", (req,res)=>{
  const { username, password } = req.body;
  db.get(`SELECT id FROM users WHERE username=? AND password=?`, [username,password], (err,row)=>{
    if(err || !row) res.json({error: "Invalid credentials"});
    else res.json({userId: row.id});
  });
});

// Add/Update Daily Stats
app.post("/update", (req,res)=>{
  const { userId, date, water, sleep, exercise, study } = req.body;
  db.get(`SELECT id FROM records WHERE user_id=? AND date=?`, [userId, date], (err,row)=>{
    if(row){
      db.run(`UPDATE records SET water=?, sleep=?, exercise=?, study=? WHERE id=?`,
        [water,sleep,exercise,study,row.id], ()=>res.json({message:"Updated record"}));
    } else {
      db.run(`INSERT INTO records(user_id,date,water,sleep,exercise,study) VALUES(?,?,?,?,?,?)`,
        [userId,date,water,sleep,exercise,study], ()=>res.json({message:"Added record"}));
    }
  });
});

// Get dashboard / all records
app.get("/dashboard/:userId", (req,res)=>{
  const userId = req.params.userId;
  db.all(`SELECT * FROM records WHERE user_id=? ORDER BY date DESC`, [userId], (err,rows)=>{
    if(err) res.json({error: err.message});
    else res.json(rows);
  });
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});
