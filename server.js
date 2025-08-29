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

// --- TABLES ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS sleep (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, hours REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS study (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, hours REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, day TEXT, food TEXT, quantity INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS hydration (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, day TEXT, glasses INTEGER)`);
});

// --- AUTH ---
app.post("/register",(req,res)=>{
  const {username,password}=req.body;
  db.run("INSERT INTO users(username,password) VALUES(?,?)",[username,password],function(err){
    if(err) return res.json({error:"Username exists"});
    res.json({message:"User registered",userId:this.lastID});
  });
});

app.post("/login",(req,res)=>{
  const {username,password}=req.body;
  db.get("SELECT id FROM users WHERE username=? AND password=?",[username,password],(err,row)=>{
    if(row) res.json({userId:row.id});
    else res.json({error:"Invalid credentials"});
  });
});

// --- DASHBOARD ---
app.get("/dashboard/:userId",(req,res)=>{
  const userId=req.params.userId;
  let data={water:0,sleep:0,study:0,meals:0};

  const today=new Date().toISOString().split("T")[0];

  db.get("SELECT SUM(glasses) as total FROM hydration WHERE user_id=? AND day=?",[userId,today],(err,row)=>{
    data.water=row?.total||0;

    db.get("SELECT SUM(hours) as total FROM sleep WHERE user_id=? AND date=?",[userId,today],(err,row2)=>{
      data.sleep=row2?.total||0;

      db.get("SELECT SUM(hours) as total FROM study WHERE user_id=? AND date=?",[userId,today],(err,row3)=>{
        data.study=row3?.total||0;

        db.get("SELECT COUNT(*) as total FROM meals WHERE user_id=? AND day=?",[userId,today],(err,row4)=>{
          data.meals=row4?.total||0;
          res.json(data);
        });
      });
    });
  });
});

// --- ENTRIES ---
app.post("/sleep/:userId/add",(req,res)=>{
  const {userId}=req.params;
  const {date,hours}=req.body;
  db.run("INSERT INTO sleep(user_id,date,hours) VALUES(?,?,?)",[userId,date,hours],()=>res.json({success:true}));
});

app.post("/study/:userId/add",(req,res)=>{
  const {userId}=req.params;
  const {date,hours}=req.body;
  db.run("INSERT INTO study(user_id,date,hours) VALUES(?,?,?)",[userId,date,hours],()=>res.json({success:true}));
});

app.post("/meals/:userId/add",(req,res)=>{
  const {userId}=req.params;
  const {food,quantity}=req.body;
  const day=new Date().toISOString().split("T")[0];
  db.run("INSERT INTO meals(user_id,day,food,quantity) VALUES(?,?,?,?)",[userId,day,food,quantity],()=>res.json({success:true}));
});

app.post("/hydration/:userId/add",(req,res)=>{
  const {userId}=req.params;
  const {glasses}=req.body;
  const day=new Date().toISOString().split("T")[0];
  db.get("SELECT * FROM hydration WHERE user_id=? AND day=?",[userId,day],(err,row)=>{
    if(row) db.run("UPDATE hydration SET glasses=glasses+? WHERE id=?",[glasses,row.id],()=>res.json({success:true}));
    else db.run("INSERT INTO hydration(user_id,day,glasses) VALUES(?,?,?)",[userId,day,glasses],()=>res.json({success:true}));
  });
});

// serve frontend
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
