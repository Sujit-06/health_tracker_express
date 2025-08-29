const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// ==== SQLite DB ====
const db = new sqlite3.Database(path.join(__dirname, "health_tracker.db"), (err)=>{
  if(err) console.error("DB Error:", err);
  else console.log("Connected to SQLite DB");
});

// ==== Tables ====
db.serialize(()=>{
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
    sessions INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    meals INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS calories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    calories INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS hydration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day TEXT,
    glasses INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ==== Routes ====

// Register
app.post("/register", (req,res)=>{
  const { username, password } = req.body;
  db.run("INSERT INTO users(username,password) VALUES(?,?)",[username,password],function(err){
    if(err) res.json({error:"User already exists"});
    else res.json({message:"User registered", userId:this.lastID});
  });
});

// Login
app.post("/login", (req,res)=>{
  const { username, password } = req.body;
  db.get("SELECT id FROM users WHERE username=? AND password=?",[username,password],(err,row)=>{
    if(err) res.json({error:"DB Error"});
    else if(row) res.json({userId:row.id});
    else res.json({error:"Invalid credentials"});
  });
});

// Get Dashboard
app.get("/dashboard/:userId", async(req,res)=>{
  const userId = req.params.userId;
  const labels = getLast7Days();

  const data = { labels, habits:[], workouts:[], meals:[], calories:[], hydration:[] };

  // Habits
  db.all("SELECT habit_name, streak FROM habits WHERE user_id=?",[userId],(err,rows)=>{
    if(rows) data.habits = rows;

    // Workouts
    db.all("SELECT day, sessions FROM workouts WHERE user_id=?",[userId],(err,ws)=>{
      const workoutMap = {}; ws.forEach(w=>workoutMap[w.day]=w.sessions);
      data.workouts = labels.map(d=>workoutMap[d]||0);

      // Meals
      db.all("SELECT day, meals FROM meals WHERE user_id=?",[userId],(err,ms)=>{
        const mealMap = {}; ms.forEach(m=>mealMap[m.day]=m.meals);
        data.meals = labels.map(d=>mealMap[d]||0);

        // Calories
        db.all("SELECT day, calories FROM calories WHERE user_id=?",[userId],(err,cs)=>{
          const calMap={}; cs.forEach(c=>calMap[c.day]=c.calories);
          data.calories = labels.map(d=>calMap[d]||0);

          // Hydration
          db.all("SELECT day, glasses FROM hydration WHERE user_id=?",[userId],(err,hs)=>{
            const hMap={}; hs.forEach(h=>hMap[h.day]=h.glasses);
            data.hydration = labels.map(d=>hMap[d]||0);

            res.json(data);
          });
        });
      });
    });
  });
});

// Add Workout
app.post("/workouts/:userId/add", (req,res)=>{
  const userId = req.params.userId;
  const { day, sessions } = req.body;
  db.get("SELECT * FROM workouts WHERE user_id=? AND day=?",[userId,day],(err,row)=>{
    if(row){
      db.run("UPDATE workouts SET sessions=sessions+? WHERE user_id=? AND day=?",[sessions,userId,day],()=>res.json({ok:true}));
    } else {
      db.run("INSERT INTO workouts(user_id,day,sessions) VALUES(?,?,?)",[userId,day,sessions],()=>res.json({ok:true}));
    }
  });
});

// Add Meal
app.post("/meals/:userId/add", (req,res)=>{
  const userId = req.params.userId;
  const { day, meals } = req.body;
  db.get("SELECT * FROM meals WHERE user_id=? AND day=?",[userId,day],(err,row)=>{
    if(row){
      db.run("UPDATE meals SET meals=meals+? WHERE user_id=? AND day=?",[meals,userId,day],()=>res.json({ok:true}));
    } else {
      db.run("INSERT INTO meals(user_id,day,meals) VALUES(?,?,?)",[userId,day,meals],()=>res.json({ok:true}));
    }
  });
});

// Add Calories
app.post("/calories/:userId/add", (req,res)=>{
  const userId = req.params.userId;
  const { day, calories } = req.body;
  db.get("SELECT * FROM calories WHERE user_id=? AND day=?",[userId,day],(err,row)=>{
    if(row){
      db.run("UPDATE calories SET calories=calories+? WHERE user_id=? AND day=?",[calories,userId,day],()=>res.json({ok:true}));
    } else {
      db.run("INSERT INTO calories(user_id,day,calories) VALUES(?,?,?)",[userId,day,calories],()=>res.json({ok:true}));
    }
  });
});

// Add Hydration
app.post("/hydration/:userId/add", (req,res)=>{
  const userId = req.params.userId;
  const { day, glasses } = req.body;
  db.get("SELECT * FROM hydration WHERE user_id=? AND day=?",[userId,day],(err,row)=>{
    if(row){
      db.run("UPDATE hydration SET glasses=glasses+? WHERE user_id=? AND day=?",[glasses,userId,day],()=>res.json({ok:true}));
    } else {
      db.run("INSERT INTO hydration(user_id,day,glasses) VALUES(?,?,?)",[userId,day,glasses],()=>res.json({ok:true}));
    }
  });
});

// ==== Helper ====
function getLast7Days(){
  const labels = [];
  const today = new Date();
  for(let i=6;i>=0;i--){
    const d = new Date(today); d.setDate(today.getDate()-i);
    labels.push(`${d.getFullYear()}-${("0"+(d.getMonth()+1)).slice(-2)}-${("0"+d.getDate()).slice(-2)}`);
  }
  return labels;
}

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
