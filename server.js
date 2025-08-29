const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database
const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to SQLite DB");
});

// Create tables
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
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    sessions INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    meals INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS hydration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    glasses INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS calories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    calories INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sleep (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    hours REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// --- AUTH ROUTES ---
app.post("/register", (req,res)=>{
  const { username, password } = req.body;
  db.run(`INSERT INTO users(username,password) VALUES(?,?)`, [username,password], function(err){
    if(err) return res.json({error:"Username exists"});
    res.json({message:"User registered", userId:this.lastID});
  });
});

app.post("/login", (req,res)=>{
  const { username,password } = req.body;
  db.get(`SELECT id FROM users WHERE username=? AND password=?`, [username,password], (err,row)=>{
    if(err) return res.json({error:err.message});
    if(row) res.json({userId: row.id});
    else res.json({error:"Invalid credentials"});
  });
});

// --- DASHBOARD ---
app.get("/dashboard/:userId", (req,res)=>{
  const userId = req.params.userId;
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  let data = {labels, habits:[], workouts:[], meals:[], hydration:[], calories:[], sleep:[]};

  db.all(`SELECT * FROM habits WHERE user_id=?`, [userId], (err,rows)=>{
    data.habits = rows;
    db.all(`SELECT * FROM workouts WHERE user_id=?`, [userId], (err,rows)=>{
      data.workouts = labels.map(d=>rows.find(r=>r.day===d)?.sessions||0);
      db.all(`SELECT * FROM meals WHERE user_id=?`, [userId], (err,rows)=>{
        data.meals = labels.map(d=>rows.find(r=>r.day===d)?.meals||0);
        db.all(`SELECT * FROM hydration WHERE user_id=?`, [userId], (err,rows)=>{
          data.hydration = labels.map(d=>rows.find(r=>r.day===d)?.glasses||0);
          db.all(`SELECT * FROM calories WHERE user_id=?`, [userId], (err,rows)=>{
            data.calories = labels.map(d=>rows.find(r=>r.day===d)?.calories||0);
            db.all(`SELECT * FROM sleep WHERE user_id=? ORDER BY date DESC`, [userId], (err,rows)=>{
              data.sleep = rows.map(r=>({date:r.date,hours:r.hours}));
              res.json(data);
            });
          });
        });
      });
    });
  });
});

// --- HABITS ---
app.post("/habits/:userId/add", (req,res)=>{
  const { userId } = req.params;
  const { habit_name } = req.body;
  db.get(`SELECT * FROM habits WHERE user_id=? AND habit_name=?`, [userId, habit_name], (err,row)=>{
    if(row) return res.json({error:"Habit exists"});
    db.run(`INSERT INTO habits(user_id,habit_name,streak) VALUES(?,?,0)`, [userId, habit_name], ()=>res.json({success:true}));
  });
});

// --- WORKOUTS ---
app.post("/workouts/:userId/add", (req,res)=>{
  const {userId} = req.params;
  const {day,sessions} = req.body;
  db.get(`SELECT * FROM workouts WHERE user_id=? AND day=?`, [userId,day], (err,row)=>{
    if(row) db.run(`UPDATE workouts SET sessions=sessions+? WHERE id=?`, [sessions,row.id], ()=>res.json({success:true}));
    else db.run(`INSERT INTO workouts(user_id,day,sessions) VALUES(?,?,?)`, [userId,day,sessions], ()=>res.json({success:true}));
  });
});

// --- MEALS ---
app.post("/meals/:userId/add", (req,res)=>{
  const {userId} = req.params;
  const {day,meals} = req.body;
  db.get(`SELECT * FROM meals WHERE user_id=? AND day=?`, [userId,day], (err,row)=>{
    if(row) db.run(`UPDATE meals SET meals=meals+? WHERE id=?`, [meals,row.id], ()=>res.json({success:true}));
    else db.run(`INSERT INTO meals(user_id,day,meals) VALUES(?,?,?)`, [userId,day,meals], ()=>res.json({success:true}));
  });
});

// --- HYDRATION ---
app.post("/hydration/:userId/add", (req,res)=>{
  const {userId} = req.params;
  const {glasses} = req.body;
  const day = new Date().toISOString().split('T')[0]; // today
  db.get(`SELECT * FROM hydration WHERE user_id=? AND day=?`, [userId,day], (err,row)=>{
    if(row) db.run(`UPDATE hydration SET glasses=glasses+? WHERE id=?`, [glasses,row.id], ()=>res.json({success:true}));
    else db.run(`INSERT INTO hydration(user_id,day,glasses) VALUES(?,?,?)`, [userId,day,glasses], ()=>res.json({success:true}));
  });
});

// --- HYDRATION RESET ---
app.post("/hydration/:userId/reset", (req,res)=>{
  const {userId} = req.params;
  const day = new Date().toISOString().split('T')[0]; // today
  db.run(`DELETE FROM hydration WHERE user_id=? AND day=?`, [userId,day], ()=>res.json({success:true}));
});

// --- CALORIES ---
app.post("/calories/:userId/add", (req,res)=>{
  const {userId} = req.params;
  const {day,calories} = req.body;
  db.get(`SELECT * FROM calories WHERE user_id=? AND day=?`, [userId,day], (err,row)=>{
    if(row) db.run(`UPDATE calories SET calories=calories+? WHERE id=?`, [calories,row.id], ()=>res.json({success:true}));
    else db.run(`INSERT INTO calories(user_id,day,calories) VALUES(?,?,?)`, [userId,day,calories], ()=>res.json({success:true}));
  });
});

// --- SLEEP ---
app.post("/sleep/:userId/add", (req,res)=>{
  const { userId } = req.params;
  const { date,hours } = req.body;
  db.run(`INSERT INTO sleep(user_id,date,hours) VALUES(?,?,?)`, [userId,date,hours], ()=>res.json({success:true}));
});

// Serve frontend
app.get("/", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

// Start server
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
