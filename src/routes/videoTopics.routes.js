// src/routes/videoTopic.routes.js

import express from "express";
import {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    deleteAllTopics,
    bulkCreateTopics,
    updateTopicStatus,
    getNextPendingTopic,
    reorderTopics,
    getTopicStats,
} from "../controllers/videoTopic.ontroller.js";

const router = express.Router();

// GET routes
router.get("/topics", getAllTopics);
router.get("/topics/stats", getTopicStats);
router.get("/topics/next", getNextPendingTopic);
router.get("/topics/:id", getTopicById);

// POST routes
router.post("/topics", createTopic);
router.post("/topics/bulk", bulkCreateTopics);
router.post("/topics/reorder", reorderTopics);

// PUT routes
router.put("/topics/:id", updateTopic);

// PATCH routes
router.patch("/topics/:id/status", updateTopicStatus);

// DELETE routes
router.delete("/topics", deleteAllTopics);
router.delete("/topics/:id", deleteTopic);

export default router;