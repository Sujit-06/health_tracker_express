const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./health_tracker.db", (err) => {
  if (err) console.error("DB error:", err);
  else console.log("Connected to SQLite DB");
});

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
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    exercise TEXT,
    sets INTEGER,
    reps INTEGER,
    duration INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    food TEXT,
    quantity INTEGER,
    calories INTEGER,
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

// --- AUTH ---
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  db.run(`INSERT INTO users(username,password) VALUES(?,?)`, [username, password], function(err){
    if(err) return res.json({ error: "Username exists" });
    res.json({ message: "User registered", userId: this.lastID });
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT id FROM users WHERE username=? AND password=?`, [username, password], (err,row)=>{
    if(err) return res.json({ error: err.message });
    if(row) res.json({ userId: row.id });
    else res.json({ error: "Invalid credentials" });
  });
});

// --- DASHBOARD ---
app.get("/dashboard/:userId", (req,res)=>{
  const userId=req.params.userId;
  const labels=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  let data={labels,habits:[],workouts:[],meals:[],hydration:[],calories:[],sleep:[],workouts_history:[],meals_history:[]};

  db.all(`SELECT * FROM habits WHERE user_id=?`,[userId],(err,rows)=>{
    data.habits=rows.map(r=>({...r,completed_today: r.completed_today}));
    db.all(`SELECT * FROM workouts WHERE user_id=?`,[userId],(err,rows)=>{
      data.workouts=labels.map(d=>rows.filter(r=>r.day===d).length);
      data.workouts_history=rows;
      db.all(`SELECT * FROM meals WHERE user_id=?`,[userId],(err,rows)=>{
        data.meals=labels.map(d=>rows.filter(r=>r.day===d).length);
        data.meals_history=rows;
        db.all(`SELECT * FROM hydration WHERE user_id=?`,[userId],(err,rows)=>{
          data.hydration=labels.map(d=>rows.find(r=>r.day===d)?.glasses || 0);
          db.all(`SELECT * FROM calories WHERE user_id=?`,[userId],(err,rows)=>{
            data.calories=labels.map(d=>rows.find(r=>r.day===d)?.calories || 0);
            db.all(`SELECT * FROM sleep WHERE user_id=? ORDER BY date DESC`,[userId],(err,rows)=>{
              data.sleep=rows.map(r=>({date:r.date,hours:r.hours}));
              res.json(data);
            });
          });
        });
      });
    });
  });
});

// --- HABITS ---
app.post("/habits/:userId/add",(req,res)=>{
  const { userId }=req.params;
  const { habit_name }=req.body;
  db.get(`SELECT * FROM habits WHERE user_id=? AND habit_name=?`,[userId,habit_name],(err,row)=>{
    if(row) return res.json({ error:"Habit exists" });
    db.run(`INSERT INTO habits(user_id,habit_name,streak,completed_today) VALUES(?,?,0,0)`,[userId,habit_name],()=>res.json({ success:true }));
  });
});

app.post("/habits/:userId/delete/:id",(req,res)=>{
  const { userId,id }=req.params;
  db.run(`DELETE FROM habits WHERE user_id=? AND id=?`,[userId,id],()=>res.json({ success:true }));
});

app.post("/habits/:userId/toggle/:id",(req,res)=>{
  const { userId,id }=req.params;
  const { completed }=req.body;
  db.run(`UPDATE habits SET completed_today=? WHERE user_id=? AND id=?`,[completed?1:0,userId,id],()=>res.json({ success:true }));
});

// --- WORKOUTS ---
app.post("/workouts/:userId/add",(req,res)=>{
  const { userId }=req.params;
  const { exercise,sets,reps,duration }=req.body;
  const day=new Date().toISOString().split('T')[0];
  db.run(`INSERT INTO workouts(user_id,day,exercise,sets,reps,duration) VALUES(?,?,?,?,?,?)`,[userId,day,exercise,sets,reps,duration],()=>res.json({success:true}));
});

// --- MEALS ---
app.post("/meals/:userId/add",(req,res)=>{
  const { userId }=req.params;
  const { food,quantity }=req.body;
  const day=new Date().toISOString().split('T')[0];
  const calories=Math.round(quantity*50);
  db.run(`INSERT INTO meals(user_id,day,food,quantity,calories) VALUES(?,?,?,?,?)`,[userId,day,food,quantity,calories],()=>res.json({success:true}));
});

// --- HYDRATION ---
app.post("/hydration/:userId/add",(req,res)=>{
  const { userId }=req.params;
  const { glasses }=req.body;
  const day=new Date().toISOString().split('T')[0];
  db.get(`SELECT * FROM hydration WHERE user_id=? AND day=?`,[userId,day],(err,row)=>{
    if(row) db.run(`UPDATE hydration SET glasses=glasses+? WHERE id=?`,[glasses,row.id],()=>res.json({success:true}));
    else db.run(`INSERT INTO hydration(user_id,day,glasses) VALUES(?,?,?)`,[userId,day,glasses],()=>res.json({success:true}));
  });
});

app.post("/hydration/:userId/reset",(req,res)=>{
  const { userId }=req.params;
  const day=new Date().toISOString().split('T')[0];
  db.run(`DELETE FROM hydration WHERE user_id=? AND day=?`,[userId,day],()=>res.json({success:true}));
});

// --- SLEEP ---
app.post("/sleep/:userId/add",(req,res)=>{
  const { userId }=req.params;
  const { date,hours }=req.body;
  db.run(`INSERT INTO sleep(user_id,date,hours) VALUES(?,?,?)`,[userId,date,hours],()=>res.json({success:true}));
});

// Serve frontend
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
