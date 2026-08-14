// src/controllers/videoTopic.controller.js

import VideoTopic from "../models/videoTopic.model.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

/**
 * GET /api/topics
 * Get all topics with pagination, sorting, and filtering
 */
export const getAllTopics = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = "order",
            sortOrder = "asc",
            status,
            search,
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = {};
        sort[sortBy] = sortOrder === "asc" ? 1 : -1;

        // Build filter
        const filter = {};
        if (status) filter.status = status;
        if (search) {
            filter.topicName = { $regex: search, $options: "i" };
        }

        const [topics, totalTopics] = await Promise.all([
            VideoTopic.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            VideoTopic.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: {
                topics,
                totalTopics,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalTopics / parseInt(limit)),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        logger.error("Error fetching topics:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch topics",
        });
    }
};

/**
 * GET /api/topics/:id
 * Get a single topic by ID
 */
export const getTopicById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid topic ID",
            });
        }

        const topic = await VideoTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                error: "Topic not found",
            });
        }

        res.status(200).json({
            success: true,
            data: topic,
        });
    } catch (error) {
        logger.error("Error fetching topic:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch topic",
        });
    }
};

/**
 * POST /api/topics
 * Create a new topic
 */
export const createTopic = async (req, res) => {
    try {
        const { topicName, order, status = "pending" } = req.body;

        if (!topicName) {
            return res.status(400).json({
                success: false,
                error: "Topic name is required",
            });
        }

        // Check if topic already exists
        const existingTopic = await VideoTopic.findOne({ topicName });
        if (existingTopic) {
            return res.status(409).json({
                success: false,
                error: "Topic already exists",
            });
        }

        // If order is not provided, set it to the next available order
        let finalOrder = order;
        if (!finalOrder) {
            const lastTopic = await VideoTopic.findOne().sort({ order: -1 });
            finalOrder = lastTopic ? lastTopic.order + 1 : 1;
        }

        const topic = await VideoTopic.create({
            topicName,
            order: finalOrder,
            status,
        });

        logger.success(`Topic created: "${topicName}"`);

        res.status(201).json({
            success: true,
            message: "Topic created successfully",
            data: topic,
        });
    } catch (error) {
        logger.error("Error creating topic:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to create topic",
        });
    }
};

/**
 * PUT /api/topics/:id
 * Update a topic
 */
export const updateTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const { topicName, order, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid topic ID",
            });
        }

        const topic = await VideoTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                error: "Topic not found",
            });
        }

        // Check if new topic name conflicts with another topic
        if (topicName && topicName !== topic.topicName) {
            const existingTopic = await VideoTopic.findOne({
                topicName,
                _id: { $ne: id },
            });
            if (existingTopic) {
                return res.status(409).json({
                    success: false,
                    error: "Topic name already exists",
                });
            }
        }

        // Update fields
        if (topicName) topic.topicName = topicName;
        if (order !== undefined) topic.order = order;
        if (status) topic.status = status;

        await topic.save();

        logger.success(`Topic updated: "${topic.topicName}"`);

        res.status(200).json({
            success: true,
            message: "Topic updated successfully",
            data: topic,
        });
    } catch (error) {
        logger.error("Error updating topic:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to update topic",
        });
    }
};

/**
 * DELETE /api/topics/:id
 * Delete a topic
 */
export const deleteTopic = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid topic ID",
            });
        }

        const topic = await VideoTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                error: "Topic not found",
            });
        }

        await VideoTopic.findByIdAndDelete(id);

        logger.success(`Topic deleted: "${topic.topicName}"`);

        res.status(200).json({
            success: true,
            message: "Topic deleted successfully",
            data: {
                id: id,
                topicName: topic.topicName,
            },
        });
    } catch (error) {
        logger.error("Error deleting topic:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to delete topic",
        });
    }
};

/**
 * DELETE /api/topics
 * Delete all topics (use with caution)
 */
export const deleteAllTopics = async (req, res) => {
    try {
        const { confirm } = req.query;
        
        // Safety check - require confirmation
        if (confirm !== "yes") {
            return res.status(400).json({
                success: false,
                error: "Confirmation required. Use ?confirm=yes to proceed",
            });
        }

        const result = await VideoTopic.deleteMany({});
        
        logger.warn(`All topics deleted: ${result.deletedCount} documents removed`);

        res.status(200).json({
            success: true,
            message: "All topics deleted successfully",
            data: {
                deletedCount: result.deletedCount,
            },
        });
    } catch (error) {
        logger.error("Error deleting all topics:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to delete all topics",
        });
    }
};

/**
 * POST /api/topics/bulk
 * Create multiple topics at once
 */
export const bulkCreateTopics = async (req, res) => {
    try {
        const { topics } = req.body;

        if (!topics || !Array.isArray(topics) || topics.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Topics array is required and cannot be empty",
            });
        }

        // Get the current max order
        const lastTopic = await VideoTopic.findOne().sort({ order: -1 });
        let nextOrder = lastTopic ? lastTopic.order + 1 : 1;

        // Prepare topics with order if not provided
        const topicsToCreate = topics.map((topic, index) => ({
            topicName: topic.topicName,
            order: topic.order || nextOrder + index,
            status: topic.status || "pending",
        }));

        // Check for duplicates
        const existingNames = await VideoTopic.find({
            topicName: { $in: topicsToCreate.map(t => t.topicName) },
        }).select("topicName");

        const existingNameSet = new Set(existingNames.map(t => t.topicName));
        const uniqueTopics = topicsToCreate.filter(
            t => !existingNameSet.has(t.topicName)
        );

        if (uniqueTopics.length === 0) {
            return res.status(409).json({
                success: false,
                error: "All topics already exist",
            });
        }

        const createdTopics = await VideoTopic.insertMany(uniqueTopics);

        logger.success(`Bulk created ${createdTopics.length} topics`);

        res.status(201).json({
            success: true,
            message: "Topics created successfully",
            data: {
                created: createdTopics,
                skipped: topics.length - createdTopics.length,
                total: topics.length,
            },
        });
    } catch (error) {
        logger.error("Error bulk creating topics:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to create topics",
        });
    }
};

/**
 * PATCH /api/topics/:id/status
 * Update topic status (pending, completed, cancelled)
 */
export const updateTopicStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid topic ID",
            });
        }

        const validStatuses = ["pending", "completed", "cancelled"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Valid values: ${validStatuses.join(", ")}`,
            });
        }

        const topic = await VideoTopic.findById(id);
        if (!topic) {
            return res.status(404).json({
                success: false,
                error: "Topic not found",
            });
        }

        topic.status = status;
        if (status === "completed") {
            topic.completedAt = new Date();
        }
        await topic.save();

        logger.success(`Topic status updated: "${topic.topicName}" -> ${status}`);

        res.status(200).json({
            success: true,
            message: "Topic status updated successfully",
            data: topic,
        });
    } catch (error) {
        logger.error("Error updating topic status:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to update topic status",
        });
    }
};

/**
 * GET /api/topics/next
 * Get the next pending topic (for daily video job)
 */
export const getNextPendingTopic = async (req, res) => {
    try {
        const topic = await VideoTopic.findOne({ status: "pending" })
            .sort({ order: 1 });

        if (!topic) {
            return res.status(404).json({
                success: false,
                error: "No pending topics available",
            });
        }

        res.status(200).json({
            success: true,
            data: topic,
        });
    } catch (error) {
        logger.error("Error fetching next pending topic:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch next pending topic",
        });
    }
};

/**
 * POST /api/topics/reorder
 * Reorder topics by updating their order values
 */
export const reorderTopics = async (req, res) => {
    try {
        const { orders } = req.body;

        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Orders array is required",
            });
        }

        // Validate all IDs
        for (const item of orders) {
            if (!mongoose.Types.ObjectId.isValid(item.id)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid topic ID: ${item.id}`,
                });
            }
        }

        // Update each topic's order
        const updatePromises = orders.map(({ id, order }) =>
            VideoTopic.findByIdAndUpdate(id, { order }, { new: true })
        );

        const updatedTopics = await Promise.all(updatePromises);

        logger.success(`Reordered ${updatedTopics.length} topics`);

        res.status(200).json({
            success: true,
            message: "Topics reordered successfully",
            data: updatedTopics,
        });
    } catch (error) {
        logger.error("Error reordering topics:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to reorder topics",
        });
    }
};

/**
 * GET /api/topics/stats
 * Get statistics about topics
 */
export const getTopicStats = async (req, res) => {
    try {
        const [total, pending, completed, cancelled] = await Promise.all([
            VideoTopic.countDocuments(),
            VideoTopic.countDocuments({ status: "pending" }),
            VideoTopic.countDocuments({ status: "completed" }),
            VideoTopic.countDocuments({ status: "cancelled" }),
        ]);

        const lastCompleted = await VideoTopic.findOne({ status: "completed" })
            .sort({ completedAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                total,
                pending,
                completed,
                cancelled,
                completionRate: total > 0 ? (completed / total) * 100 : 0,
                lastCompleted: lastCompleted || null,
            },
        });
    } catch (error) {
        logger.error("Error fetching topic stats:", error.message);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch topic stats",
        });
    }
};