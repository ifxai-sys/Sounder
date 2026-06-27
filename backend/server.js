const express = require("express");
const dotenv  = require("dotenv");
const cors    = require("cors");

const connectDB  = require("./config/db");
const authRoutes = require("./routes/auth");

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ──
app.use(cors({
    origin: "*",           // Allow all origins (tighten in production)
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// ── Routes ──
app.get("/", (req, res) => {
    res.json({ message: "Sounder API running ✅" });
});

app.use("/api/auth", authRoutes);

// ── 404 handler ──
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
