const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Connect DB
const db = new sqlite3.Database("./health.db", (err)=>{
  if(err) console.error("DB Error: ", err);
  else console.log("SQLite DB connected.");
});

// Create tables
db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS records(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    date TEXT,
    water INTEGER,
    sleep INTEGER,
    exercise INTEGER,
    study INTEGER,
    UNIQUE(userId,date)
  )`);
});

// Register
app.post("/register", (req,res)=>{
  const {username,password} = req.body;
  db.run("INSERT INTO users(username,password) VALUES(?,?)",[username,password],function(err){
    if(err) return res.json({error:"User already exists"});
    res.json({message:"User registered"});
  });
});

// Login
app.post("/login",(req,res)=>{
  const {username,password} = req.body;
  db.get("SELECT * FROM users WHERE username=? AND password=?",[username,password],(err,row)=>{
    if(row) res.json({userId:row.id});
    else res.json({error:"Invalid credentials"});
  });
});

// Add/Update record
app.post("/update",(req,res)=>{
  const {userId,date,water,sleep,exercise,study} = req.body;
  db.run(`INSERT INTO records(userId,date,water,sleep,exercise,study)
          VALUES(?,?,?,?,?,?)
          ON CONFLICT(userId,date) DO UPDATE SET
            water=excluded.water,
            sleep=excluded.sleep,
            exercise=excluded.exercise,
            study=excluded.study`,
    [userId,date,water,sleep,exercise,study],
    (err)=>{
      if(err) res.json({error:"Error saving record"});
      else res.json({message:"Record saved"});
    });
});

// Dashboard data
app.get("/dashboard/:userId",(req,res)=>{
  const {userId} = req.params;
  db.all("SELECT * FROM records WHERE userId=? ORDER BY date DESC",[userId],(err,rows)=>{
    if(err) res.json([]);
    else res.json(rows);
  });
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
