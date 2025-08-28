import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import db from "./db.js";   // ✅ Now this will work!

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// --- API Routes ---

// Signup
app.post("/api/signup", (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = bcrypt.hashSync(password, 10);

  const query = `INSERT INTO users (email, password) VALUES (?, ?)`;
  db.run(query, [email, hashedPassword], function (err) {
    if (err) {
      console.error("❌ Signup error:", err.message);
      return res.status(400).json({ message: "User already exists" });
    }
    res.json({ message: "✅ Signup successful", userId: this.lastID });
  });
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ?`;
  db.get(query, [email], (err, user) => {
    if (err) {
      console.error("❌ Login error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({ message: "✅ Login successful", userId: user.id });
  });
});

// Default
app.get("/", (req, res) => {
  res.send("✅ Backend running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
