import express from "express";
import {
    postOnYoutube,
    generateAndPostToYoutube,
    testConnection,
    getAccounts,
} from "../controllers/youtube.controller.js";

const router = express.Router();

router.get("/test", testConnection);
router.get("/accounts", getAccounts);

// Manual post with a ready-made body
router.post("/", postOnYoutube);

// Runs the full generate -> post pipeline (used by the daily cron too)
router.post("/generate-and-post", generateAndPostToYoutube);

router.get("/health", (req, res) => {
    res.json({ status: "OK", service: "YouTube Posting Service", timestamp: new Date().toISOString() });
});

export default router;
