// server.js
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import db from "./db.js"; // Import database

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------- Routes ----------------

// Test route
app.get("/", (req, res) => {
  res.send("✅ Health Tracker Backend is running on Render");
});

// Register user
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.run("INSERT INTO users (email, password) VALUES (?, ?)", [
      email,
      hashedPassword,
    ]);

    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Login user
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
