// src/jobs/dailyVideo.job.js
//
// Runs once a day at 4:00 PM (server local time). Picks the next pending
// topic, runs the full generation pipeline, then *enqueues* PostQueue
// documents instead of posting directly — the separate postWorker job
// (src/jobs/postWorker.job.js) picks those up and does the actual posting.
// Splitting generation from posting means a slow/failed post never blocks
// tomorrow's generation, and posting gets its own independent retry loop.

import cron from "node-cron";
import { generateVideoForTopic } from "../services/pipeline.service.js";
import { getNextPendingTopic, markTopicCompleted, markTopicCancelled } from "../services/topic.service.js";
import PostQueue from "../models/post.model.js";
import { logger } from "../utils/logger.js";
import sendEmail from "../services/sendEmail.service.js";

const CRON_EXPRESSION = process.env.DAILY_VIDEO_CRON || "0 16 * * *"; // 4:00 PM daily
const POST_TO_INSTAGRAM = String(process.env.POST_TO_INSTAGRAM || "false").toLowerCase() === "true";

// Helper function to get notification email from env or use default
const getNotificationEmail = () => {
    return process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || 'admin@example.com';
};

// Helper to send daily job summary email
const sendDailyJobSummary = async (topicDoc, result, postsQueued) => {
    const email = getNotificationEmail();
    const subject = `📅 Daily Video Generation Complete: ${topicDoc.topicName}`;
    
    const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4CAF50;">📅 Daily Video Generation Complete</h2>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Topic:</strong> ${topicDoc.topicName}</p>
                <p><strong>Generated At:</strong> ${new Date().toISOString()}</p>
                <p><strong>Posts Queued:</strong> ${postsQueued.length}</p>
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-radius: 5px;">
                <h3 style="color: #1976D2;">🎬 Generated Video Details</h3>
                <p><strong>Title:</strong> ${result.title}</p>
                <p><strong>Description:</strong> ${result.description || 'N/A'}</p>
                <p><strong>Tags:</strong> ${Array.isArray(result.tags) ? result.tags.join(', ') : 'N/A'}</p>
                <p><strong>Video URL:</strong> <a href="${result.videoUrl}" target="_blank">View Video</a></p>
                ${result.thumbnailUrl ? `<p><strong>Thumbnail:</strong> <a href="${result.thumbnailUrl}" target="_blank">View Thumbnail</a></p>` : ''}
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e9; border-radius: 5px;">
                <h3 style="color: #2E7D32;">📋 Queued Posts</h3>
                <ul>
                    ${postsQueued.map(post => `
                        <li>
                            <strong>${post.platform}</strong> - ${post.contentType || 'video'}
                            ${post.status === 'queued' ? '✅' : '❌'}
                        </li>
                    `).join('')}
                </ul>
                <p style="margin-top: 10px; color: #666; font-size: 12px;">
                    The post worker will publish these automatically.
                </p>
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px;">
                <h3 style="color: #e65100;">📌 Next Steps</h3>
                <ul>
                    <li>Monitor the post worker logs for publishing status</li>
                    <li>Check the platform for the published content</li>
                    <li>Verify video quality and engagement</li>
                </ul>
            </div>

            <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
            
            <p style="color: #666; font-size: 12px;">
                This is an automated notification from your Daily Video Generation System.
                Please do not reply to this email.
            </p>
        </div>
    `;

    try {
        await sendEmail(email, subject, body);
        logger.info(`Daily job summary email sent to ${email}`);
    } catch (error) {
        logger.error('Failed to send daily job summary email:', error.message);
    }
};

// Helper to send daily job error email
const sendDailyJobError = async (topicDoc, error) => {
    const email = getNotificationEmail();
    const subject = `❌ Daily Video Generation Failed: ${topicDoc.topicName}`;
    
    const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #f44336;">❌ Daily Video Generation Failed</h2>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px; border-left: 4px solid #f44336;">
                <h3 style="color: #d32f2f;">Error Details</h3>
                <p><strong>Error Message:</strong> ${error.message}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p><strong>Topic:</strong> ${topicDoc.topicName}</p>
                ${error.stack ? `<details><summary style="cursor: pointer; color: #1976D2;">View Stack Trace</summary><pre style="background: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; margin-top: 10px;">${error.stack}</pre></details>` : ''}
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #ffebee; border-radius: 5px;">
                <h3 style="color: #c62828;">⚠️ Action Required</h3>
                <p>Please check the following:</p>
                <ul>
                    <li>Verify the topic "${topicDoc.topicName}" is valid</li>
                    <li>Check if the video generation pipeline is working</li>
                    <li>Verify Cloudinary credentials and storage</li>
                    <li>Check if the topic has enough content to generate a video</li>
                    <li>Review the video generation logs for more details</li>
                </ul>
            </div>

            <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
            
            <p style="color: #666; font-size: 12px;">
                This is an automated error notification from your Daily Video Generation System.
                Please investigate and resolve the issue.
            </p>
        </div>
    `;

    try {
        await sendEmail(email, subject, body);
        logger.info(`Daily job error email sent to ${email}`);
    } catch (emailError) {
        logger.error('Failed to send daily job error email:', emailError.message);
    }
};

export async function runDailyVideoJob() {
    logger.info("⏰ Daily video job triggered");

    const topicDoc = await getNextPendingTopic();
    if (!topicDoc) {
        logger.warn("Daily video job skipped: topic queue is empty. Add more topics to VideoTopic.");
        // Send notification that no topics are available
        const email = getNotificationEmail();
        const subject = "⚠️ Daily Video Job: No Topics Available";
        const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #ff9800;">⚠️ Daily Video Job: No Topics Available</h2>
                <p>The daily video job was triggered but no pending topics were found in the queue.</p>
                <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                    <p><strong>Time:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Status:</strong> Skipped</p>
                </div>
                <p>Please add more topics to VideoTopic collection to continue daily video generation.</p>
                <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
                <p style="color: #666; font-size: 12px;">This is an automated notification from your Daily Video Generation System.</p>
            </div>
        `;
        try {
            await sendEmail(email, subject, body);
        } catch (error) {
            logger.error('Failed to send no-topics notification email:', error.message);
        }
        return;
    }

    try {
        const result = await generateVideoForTopic(topicDoc.topicName);

        // Always queue a YouTube post.
        const youtubePost = await PostQueue.create({
            topic: topicDoc._id,
            platform: "youtube",
            contentType: "video",
            videoPath: result.videoPath,
            thumbnailPath: result.thumbnailPath,
            videoUrl: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            title: result.title,
            description: result.description,
            tags: result.tags,
            status: "queued",
        });

        const queuedPosts = [youtubePost];

        // Optionally also queue an Instagram reel using the same asset.
        if (POST_TO_INSTAGRAM) {
            const caption = `${result.description}\n\n${(result.hashtags || []).join(" ")}`.trim();
            const instagramPost = await PostQueue.create({
                topic: topicDoc._id,
                platform: "instagram",
                contentType: "reel",
                videoPath: result.videoPath,
                thumbnailPath: result.thumbnailPath,
                videoUrl: result.videoUrl,
                thumbnailUrl: result.thumbnailUrl,
                title: result.title,
                description: caption,
                tags: result.tags,
                status: "queued",
            });
            queuedPosts.push(instagramPost);
        }

        await markTopicCompleted(topicDoc._id, result.videoPath);
        logger.success(`Daily video job done for "${topicDoc.topicName}". Posts queued for worker.`);

        // Send success summary email
        await sendDailyJobSummary(topicDoc, result, queuedPosts);
    } catch (error) {
        logger.error(`Daily video job failed for "${topicDoc.topicName}":`, error.message);
        // Leave status as "pending" by default so it's retried tomorrow;
        // flip to cancelled instead if you'd rather skip broken topics:
        // await markTopicCancelled(topicDoc._id);
        
        // Send error email
        await sendDailyJobError(topicDoc, error);
    }
}

export function scheduleDailyVideoJob() {
    cron.schedule(CRON_EXPRESSION, runDailyVideoJob);
    logger.info(`📅 Daily video job scheduled: "${CRON_EXPRESSION}" (POST_TO_INSTAGRAM=${POST_TO_INSTAGRAM})`);
}