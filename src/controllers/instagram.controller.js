// src/controllers/instagram.controller.js

import { postReelToInstagram, postStoryToInstagram, listZernioAccounts } from "../services/zernio.service.js";
import { testZernioConnection } from "../config/zernio.config.js";
import { generateVideoForTopic } from "../services/pipeline.service.js";
import { getNextPendingTopic, markTopicCompleted } from "../services/topic.service.js";
import PostQueue from "../models/post.model.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/instagram/share-story
 * NOTE: mediaUrl must already be a public URL — Zernio rejects
 * localhost/private-network URLs.
 */
export const publishStoryInstagram = async (req, res) => {
    const { mediaUrl } = req.body;

    if (!mediaUrl) {
        return res.status(400).json({ success: false, message: "mediaUrl is required" });
    }

    try {
        const response = await postStoryToInstagram({ mediaUrl });
        res.status(200).json({ success: true, message: "Instagram story published successfully", data: response });
    } catch (error) {
        logger.error("Instagram story error:", error.message);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to publish Instagram story",
        });
    }
};

/**
 * POST /api/instagram/reel — manual reel post with a caption you already have.
 */
export const publishReelInstagram = async (req, res) => {
    const { caption, videoUrl, thumbnail } = req.body;

    if (!caption || !videoUrl) {
        return res.status(400).json({ success: false, message: "caption and videoUrl are required" });
    }

    try {
        const response = await postReelToInstagram({ caption, videoUrl, thumbnail });
        res.status(200).json({ success: true, message: "Instagram reel published successfully", data: response });
    } catch (error) {
        logger.error("Instagram reel error:", error.message);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to publish Instagram reel",
        });
    }
};

/**
 * POST /api/instagram/generate-and-post — runs the full pipeline and posts
 * the result as a Reel with a professional caption + hashtags.
 */
export const generateAndPostToInstagram = async (req, res) => {
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
        const caption = `${result.description}\n\n${(result.hashtags || []).join(" ")}`.trim();

        // result.videoUrl / result.thumbnailUrl are already public Cloudinary
        // URLs (uploaded inside the pipeline) — no local-path conversion needed.
        const posted = await postReelToInstagram({
            caption,
            videoUrl: result.videoUrl,
            thumbnail: result.thumbnailUrl,
        });

        if (topicDoc) await markTopicCompleted(topicDoc._id, result.videoPath);

        await PostQueue.create({
            topic: topicDoc?._id,
            platform: "instagram",
            contentType: "reel",
            videoPath: result.videoPath,
            thumbnailPath: result.thumbnailPath,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            title: result.title,
            description: caption,
            tags: result.tags,
            status: "posted",
            postedAt: new Date(),
        });

        res.status(200).json({ success: true, message: "Video generated and posted to Instagram", result: posted });
    } catch (error) {
        logger.error("generate-and-post (Instagram) error:", error.message);
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
