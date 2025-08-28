import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Path helpers for serving frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Initialize SQLite DB
let db;
const initDB = async () => {
  db = await open({
    filename: "./database.sqlite",
    driver: sqlite3.Database,
  });

  // Create users table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);
};

// Signup route
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
      name,
      email,
      hashedPassword,
    ]);

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error signing up" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid email or password" });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error logging in" });
  }
});

// Start server after DB init
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});
