const express = require("express"); 
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public"))); // put index.html inside 'public' folder

const PORT = process.env.PORT || 3000;

// In-memory database
const users = {};

// Helper function to get today's date string
function today() {
  return new Date().toISOString().split("T")[0];
}

// REGISTER
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ error: "Invalid data" });
  const userExists = Object.values(users).find(u => u.username === username);
  if (userExists) return res.json({ error: "User already exists" });

  const userId = uuidv4();
  users[userId] = {
    id: userId,
    username,
    password,
    habits: [],
    workouts_history: [],
    meals_history: [],
    sleep: [],
    hydration: [],
    calories: [],
  };
  res.json({ message: "User registered", userId });
});

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  if (!user) return res.json({ error: "Invalid credentials" });
  res.json({ userId: user.id });
});

// DASHBOARD
app.get("/dashboard/:userId", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });

  const labels = [];
  const calories = [];
  const workouts = [];
  const meals = [];
  const hydration = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    labels.push(dateStr);

    const dayCalories = user.meals_history
      .filter(m => m.day === dateStr)
      .reduce((sum, m) => sum + m.calories, 0);
    calories.push(dayCalories);

    const dayWorkouts = user.workouts_history.filter(w => w.day === dateStr).length;
    workouts.push(dayWorkouts);

    const dayMeals = user.meals_history.filter(m => m.day === dateStr).length;
    meals.push(dayMeals);

    const dayHydration = user.hydration.find(h => h.day === dateStr)?.glasses || 0;
    hydration.push(dayHydration);
  }

  res.json({
    habits: user.habits,
    workouts_history: user.workouts_history,
    meals_history: user.meals_history,
    sleep: user.sleep,
    hydration: user.hydration,
    calories,
    workouts,
    meals,
    labels
  });
});

// HABITS
app.post("/habits/:userId/add", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const { habit_name } = req.body;
  const habit = { id: uuidv4(), habit_name, streak: 0, completed_today: false };
  user.habits.push(habit);
  res.json({ message: "Habit added" });
});

app.post("/habits/:userId/delete/:habitId", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  user.habits = user.habits.filter(h => h.id !== req.params.habitId);
  res.json({ message: "Habit deleted" });
});

app.post("/habits/:userId/toggle/:habitId", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const habit = user.habits.find(h => h.id === req.params.habitId);
  if (!habit) return res.json({ error: "Habit not found" });
  const { completed } = req.body;
  habit.completed_today = completed;
  habit.streak = completed ? habit.streak + 1 : Math.max(habit.streak - 1, 0);
  res.json({ message: "Habit updated" });
});

// WORKOUTS
app.post("/workouts/:userId/add", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const { exercise, sets, reps, duration } = req.body;
  user.workouts_history.push({ day: today(), exercise, sets, reps, duration });
  res.json({ message: "Workout added" });
});

// MEALS
app.post("/meals/:userId/add", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const { food, quantity, calories } = req.body;
  user.meals_history.push({ day: today(), food, quantity, calories });
  res.json({ message: "Meal added" });
});

// SLEEP
app.post("/sleep/:userId/add", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const { date, hours } = req.body;
  user.sleep.push({ date, hours });
  res.json({ message: "Sleep added" });
});

// HYDRATION
app.post("/hydration/:userId/add", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  const { glasses } = req.body;
  const todayHydration = user.hydration.find(h => h.day === today());
  if (todayHydration) todayHydration.glasses += glasses;
  else user.hydration.push({ day: today(), glasses });
  res.json({ message: "Hydration added" });
});

app.post("/hydration/:userId/reset", (req, res) => {
  const user = users[req.params.userId];
  if (!user) return res.json({ error: "User not found" });
  user.hydration = user.hydration.filter(h => h.day !== today());
  res.json({ message: "Hydration reset" });
});

// Serve frontend for any other GET request
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
