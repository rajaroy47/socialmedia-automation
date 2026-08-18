import express from "express";
import {
    publishStoryInstagram,
    publishReelInstagram,
    generateAndPostToInstagram,
    testConnection,
    getAccounts,
} from "../controllers/instagram.controller.js";

const router = express.Router();

router.get("/test", testConnection);
router.get("/accounts", getAccounts);

router.post("/share-story", publishStoryInstagram);
router.post("/reel", publishReelInstagram);

// Runs the full generate -> post pipeline (used by the daily cron too)
router.post("/generate-and-post", generateAndPostToInstagram);

router.get("/health", (req, res) => {
    res.json({ status: "OK", service: "Instagram Posting Service", timestamp: new Date().toISOString() });
});

export default router;