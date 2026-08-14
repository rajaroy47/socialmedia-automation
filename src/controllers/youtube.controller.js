// src/controllers/youtube.controller.js

import { postVideoToYoutube, listZernioAccounts } from "../services/zernio.service.js";
import { testZernioConnection } from "../config/zernio.config.js";
import { generateVideoForTopic } from "../services/pipeline.service.js";
import { getNextPendingTopic, markTopicCompleted } from "../services/topic.service.js";
import PostQueue from "../models/post.model.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/youtube  — manual post with a body you already have ready
 * (title, description, videoUrl, thumbnail, tags, visibility...).
 * NOTE: videoUrl/thumbnail here must already be public URLs (e.g.
 * Cloudinary) — Zernio rejects localhost/private-network URLs.
 */
export const postOnYoutube = async (req, res) => {
    try {
        const {
            title,
            description,
            videoUrl, // cloudinary video url
            thumbnail, // cloudinary video thumbnail
            tags = [],
            visibility = "public",
            categoryId = "22",
            language = "en",
        } = req.body;

        const missingFields = ["title", "description", "videoUrl"].filter((f) => !req.body[f]);
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(", ")}`,
            });
        }

        const result = await postVideoToYoutube({
            title,
            description,
            videoUrl,
            thumbnail,
            tags,
            visibility,
            categoryId,
            language,
        });

        res.status(200).json({
            success: true,
            message: "Video posted successfully to YouTube",
            data: result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error("YouTube post error:", error.message);
        res.status(error.statusCode || 500).json({
            success: false,
            error: error.message || "Failed to post video to YouTube",
            timestamp: new Date().toISOString(),
        });
    }
};

/**
 * POST /api/youtube/generate-and-post — runs the full pipeline for a given
 * topic (or the next queued one) and immediately posts the result. Useful
 * for testing the daily job on demand.
 */
export const generateAndPostToYoutube = async (req, res) => {
    try {
        let { topic } = req.body;
        let topicDoc = null;

        if (!topic) {
            topicDoc = await getNextPendingTopic();
            if (!topicDoc) {
                return res.status(400).json({ success: false, error: "No topic provided and topic queue is empty" });
            }
            topic = topicDoc.topicName;
        }

        const result = await generateVideoForTopic(topic);

        // result.videoUrl / result.thumbnailUrl are already public Cloudinary
        // URLs (uploaded inside the pipeline) — no local-path conversion needed.
        const posted = await postVideoToYoutube({
            title: result.title,
            description: result.description,
            videoUrl: result.videoUrl,
            thumbnail: result.thumbnailUrl,
            tags: result.tags,
        });

        if (topicDoc) await markTopicCompleted(topicDoc._id, result.videoPath);

        // Also drop a record in the queue for traceability / retries even
        // though we posted synchronously here.
        await PostQueue.create({
            topic: topicDoc?._id,
            platform: "youtube",
            contentType: "video",
            videoPath: result.videoPath,
            thumbnailPath: result.thumbnailPath,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            title: result.title,
            description: result.description,
            tags: result.tags,
            status: "posted",
            postedAt: new Date(),
        });

        res.status(200).json({ success: true, message: "Video generated and posted to YouTube", result: posted });
    } catch (error) {
        logger.error("generate-and-post (YouTube) error:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const testConnection = async (req, res) => {
    try {
        const accounts = await testZernioConnection();
        res.status(200).json({ success: true, message: "Zernio connection successful", accounts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAccounts = async (req, res) => {
    try {
        const accounts = await listZernioAccounts();
        res.status(200).json({ success: true, accounts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
