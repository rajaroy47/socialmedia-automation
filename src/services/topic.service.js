// src/services/topic.service.js

import VideoTopic from "../models/videoTopic.model.js";
import { logger } from "../utils/logger.js";

/**
 * Returns the lowest-`order`, still-`pending` topic, or null if the queue
 * is empty (in which case the daily job just logs and skips that day).
 */
export async function getNextPendingTopic() {
    const topic = await VideoTopic.findOne({ status: "pending" }).sort({ order: 1 });
    if (!topic) {
        logger.warn("No pending topics left in the queue.");
        return null;
    }
    return topic;
}

export async function markTopicCompleted(topicId, videoPath) {
    return VideoTopic.findByIdAndUpdate(topicId, {
        status: "completed",
        lastVideoPath: videoPath,
        completedAt: new Date(),
    });
}

export async function markTopicCancelled(topicId) {
    return VideoTopic.findByIdAndUpdate(topicId, { status: "cancelled" });
}

/**
 * Convenience bulk-loader so you can seed the queue quickly, e.g. from a
 * one-off script: seedTopics(["Solar energy facts", "Ocean mysteries", ...])
 */
export async function seedTopics(topicNames = []) {
    const existingCount = await VideoTopic.countDocuments();
    const docs = topicNames.map((topicName, i) => ({
        topicName,
        order: existingCount + i + 1,
    }));
    if (docs.length === 0) return [];
    return VideoTopic.insertMany(docs, { ordered: true });
}
