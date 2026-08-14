// server.js - main entry point

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

import connectDB from "./src/config/db.config.js";
import { ensureDirectories, PUBLIC_DIR, UPLOAD_DIR, GENERATED_ROOT, GENERATED_DIR } from "./src/config/paths.config.js";
import { logger } from "./src/utils/logger.js";

import youtubeRoutes from "./src/routes/youtube.routes.js";
import instagramRoutes from "./src/routes/instagram.routes.js";
import videoTopicsRoutes from "./src/routes/videoTopics.routes.js";
import authRoutes from "./src/routes/auth.routes.js";

import { protect } from "./src/middlewares/auth.middleware.js";
import { ensureAdminSeed } from "./src/services/auth.service.js";

import { scheduleDailyVideoJob, runDailyVideoJob } from "./src/jobs/dailyVideo.job.js";
import { schedulePostWorker, runPostWorker } from "./src/jobs/postWorker.job.js";
import { generateVideoForTopic } from "./src/services/pipeline.service.js";
import { seedTopics, getNextPendingTopic } from "./src/services/topic.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

ensureDirectories();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.static(PUBLIC_DIR));
app.use("/public", express.static(PUBLIC_DIR));
app.use("/generatedOutput", express.static(GENERATED_ROOT));

// ============================================
// HEALTH CHECK
// ============================================
app.get("/", (req, res) => {
    res.json({ status: "Server is running", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        service: "Social Automation Server",
        version: "1.0.0",
        endpoints: {
            youtube: "/api/youtube",
            instagram: "/api/instagram",
        },
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// ROUTES
// ============================================
app.use("/api/auth", authRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/instagram", instagramRoutes);
// Everything backing the Topics Manager UI requires a valid admin login.
app.use("/api", protect, videoTopicsRoutes)

// ============================================
// TOPIC QUEUE (seed / inspect)
// ============================================
app.post("/api/topics/seed", async (req, res) => {
    try {
        const { topics = [] } = req.body;
        if (!Array.isArray(topics) || topics.length === 0) {
            return res.status(400).json({ success: false, error: "topics must be a non-empty array of strings" });
        }
        const created = await seedTopics(topics);
        res.json({ success: true, created });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/topics/next", async (req, res) => {
    try {
        const topic = await getNextPendingTopic();
        res.json({ success: true, topic });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MANUAL PIPELINE TRIGGERS (handy for testing)
// ============================================

// Generates a video only (does not post it anywhere).
app.post("/api/generate-video", async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || !topic.trim()) {
            return res.status(400).json({ success: false, error: "topic is required" });
        }
        const result = await generateVideoForTopic(topic.trim());
        res.json({ success: true, result });
    } catch (error) {
        logger.error("Manual video generation error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manually fire the daily job / post worker right now instead of waiting
// for their cron schedules — useful while testing.
app.post("/api/jobs/run-daily-video", async (req, res) => {
    runDailyVideoJob()
        .then(() => logger.info("Manual daily video job run complete"))
        .catch((err) => logger.error("Manual daily video job run failed:", err.message));
    res.json({ success: true, message: "Daily video job triggered in the background" });
});

app.post("/api/jobs/run-post-worker", async (req, res) => {
    runPostWorker()
        .then(() => logger.info("Manual post worker run complete"))
        .catch((err) => logger.error("Manual post worker run failed:", err.message));
    res.json({ success: true, message: "Post worker triggered in the background" });
});

// ============================================
// FILE UPLOAD (generic helper endpoint)
// ============================================
const uploadDir = UPLOAD_DIR;
try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
    logger.error(`Could not create upload directory "${uploadDir}": ${error.message}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        file: {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
        },
    });
});

import sendEmail from "./src/services/sendEmail.service.js";

const gmailBody = "<h3>This is <u>also</u> a Demo Message</h3>";

// setTimeout(()=>{
//     sendEmail("mrajaroy.47@gmail.com", "Test Mail", gmailBody)
// }, 5000)

// ============================================
// START SERVER
// ============================================
async function start() {
    let dbConnected = false;
    try {
        await connectDB();
        dbConnected = true;
    } catch (error) {
        logger.warn("Starting server without a confirmed DB connection — topic/post queue routes will fail until MongoDB is reachable.");
    }

    if (dbConnected) {
        try {
            await ensureAdminSeed();
        } catch (error) {
            logger.error("Failed to seed admin account:", error.message);
        }
    } else {
        logger.warn("Skipping admin seed check — no DB connection. Login will fail until MongoDB is reachable and the server is restarted.");
    }

    scheduleDailyVideoJob();
    schedulePostWorker();

    app.listen(PORT, () => {
        logger.success(`Server running on http://localhost:${PORT}`);
        logger.info(`Generated media root: ${GENERATED_ROOT}`);
        logger.info(`BASE_URL for public media links: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
    });
}

start();
