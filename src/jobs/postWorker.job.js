// src/jobs/postWorker.job.js
//
// The "posting worker" merged into the main project as its own cron job
// instead of a separate process. Runs every few minutes, grabs whatever is
// sitting in PostQueue with status "queued" (or "failed" but still under
// maxAttempts), and pushes it out via Zernio — recursively retrying a given
// post immediately across a couple of attempts before leaving it for the
// next tick, so a transient Zernio hiccup doesn't need a full posting cycle
// to recover from.

import cron from "node-cron";
import PostQueue from "../models/post.model.js";
import { postVideoToYoutube, postReelToInstagram } from "../services/zernio.service.js";
import { logger } from "../utils/logger.js";
import sendEmail from "../services/sendEmail.service.js";

const CRON_EXPRESSION = process.env.POST_WORKER_CRON || "*/5 * * * *"; // every 5 minutes
const IMMEDIATE_RETRIES = 2; // quick retries within a single tick before giving up until next tick

// Helper function to get notification email from env or use default
const getNotificationEmail = () => {
    return process.env.NOTIFICATION_EMAIL || process.env.SMTP_USER || 'admin@example.com';
};

// Helper to send success email
const sendSuccessEmail = async (postDoc, result) => {
    const email = getNotificationEmail();
    const subject = `✅ ${postDoc.platform} Post Published Successfully: ${postDoc.title}`;
    
    // Get the video URL from the response (Zernio might return a different structure)
    const postLink = result?.data?.postUrl || result?.postUrl || postDoc.videoUrl || 'URL not available';
    
    const platformEmoji = postDoc.platform === 'youtube' ? '▶️' : '📸';
    const platformName = postDoc.platform === 'youtube' ? 'YouTube' : 'Instagram';
    
    const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4CAF50;">${platformEmoji} ${platformName} Post Published Successfully</h2>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <p><strong>Platform:</strong> ${platformName}</p>
                <p><strong>Title:</strong> ${postDoc.title}</p>
                <p><strong>Description:</strong> ${postDoc.description || 'N/A'}</p>
                <p><strong>Content Type:</strong> ${postDoc.contentType || 'video'}</p>
                <p><strong>Tags:</strong> ${Array.isArray(postDoc.tags) ? postDoc.tags.join(', ') : 'N/A'}</p>
                <p><strong>Posted At:</strong> ${new Date().toISOString()}</p>
                <p><strong>Attempts:</strong> ${postDoc.attempts}</p>
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-radius: 5px;">
                <h3 style="color: #1976D2;">🔗 Post Links</h3>
                <p><strong>Public Link:</strong> <a href="${postLink}" target="_blank">${postLink}</a></p>
                ${postDoc.thumbnailUrl ? `<p><strong>Thumbnail:</strong> <a href="${postDoc.thumbnailUrl}" target="_blank">View Thumbnail</a></p>` : ''}
                ${postDoc.videoUrl ? `<p><strong>Video URL:</strong> <a href="${postDoc.videoUrl}" target="_blank">View Video</a></p>` : ''}
                ${postDoc.platformPostId ? `<p><strong>Post ID:</strong> ${postDoc.platformPostId}</p>` : ''}
            </div>

            ${postDoc.topic ? `<div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px;">
                <h3 style="color: #e65100;">📌 Topic Reference</h3>
                <p><strong>Topic ID:</strong> ${postDoc.topic}</p>
            </div>` : ''}

            <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e9; border-radius: 5px;">
                <h3 style="color: #2E7D32;">📊 Response Data</h3>
                <pre style="background: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${JSON.stringify(result, null, 2)}</pre>
            </div>

            <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
            
            <p style="color: #666; font-size: 12px;">
                This is an automated notification from your Post Publishing System.
                Please do not reply to this email.
            </p>
        </div>
    `;

    try {
        await sendEmail(email, subject, body);
        logger.info(`Success email sent to ${email} for ${postDoc.platform} post: ${postDoc.title}`);
    } catch (error) {
        logger.error('Failed to send success email:', error.message);
    }
};

// Helper to send error email
const sendErrorEmail = async (postDoc, error) => {
    const email = getNotificationEmail();
    const subject = `❌ ${postDoc.platform} Post Failed: ${postDoc.title}`;
    
    const platformEmoji = postDoc.platform === 'youtube' ? '▶️' : '📸';
    const platformName = postDoc.platform === 'youtube' ? 'YouTube' : 'Instagram';
    
    const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #f44336;">❌ ${platformEmoji} ${platformName} Post Failed</h2>
            
            <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px; border-left: 4px solid #f44336;">
                <h3 style="color: #d32f2f;">Error Details</h3>
                <p><strong>Error Message:</strong> ${error.message}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p><strong>Attempts:</strong> ${postDoc.attempts} / ${postDoc.maxAttempts}</p>
                ${error.stack ? `<details><summary style="cursor: pointer; color: #1976D2;">View Stack Trace</summary><pre style="background: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; margin-top: 10px;">${error.stack}</pre></details>` : ''}
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <h3 style="color: #333;">Post Context</h3>
                <p><strong>Platform:</strong> ${platformName}</p>
                <p><strong>Title:</strong> ${postDoc.title || 'N/A'}</p>
                <p><strong>Description:</strong> ${postDoc.description || 'N/A'}</p>
                <p><strong>Content Type:</strong> ${postDoc.contentType || 'video'}</p>
                <p><strong>Tags:</strong> ${Array.isArray(postDoc.tags) ? postDoc.tags.join(', ') : 'N/A'}</p>
                ${postDoc.videoUrl ? `<p><strong>Video URL:</strong> <a href="${postDoc.videoUrl}" target="_blank">${postDoc.videoUrl}</a></p>` : ''}
                ${postDoc.thumbnailUrl ? `<p><strong>Thumbnail:</strong> <a href="${postDoc.thumbnailUrl}" target="_blank">View Thumbnail</a></p>` : ''}
            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #ffebee; border-radius: 5px;">
                <h3 style="color: #c62828;">⚠️ Action Required</h3>
                <p>Please check the following:</p>
                <ul>
                    <li>Verify ${platformName} account credentials and permissions</li>
                    <li>Check if the ${postDoc.contentType} URL is accessible (not localhost)</li>
                    <li>Verify Zernio API key is valid</li>
                    <li>Check network connectivity</li>
                    <li>Review Zernio API documentation for any changes</li>
                    <li>Check if the post has exceeded max attempts (${postDoc.maxAttempts})</li>
                </ul>
            </div>

            <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
            
            <p style="color: #666; font-size: 12px;">
                This is an automated error notification from your Post Publishing System.
                Please investigate and resolve the issue.
            </p>
        </div>
    `;

    try {
        await sendEmail(email, subject, body);
        logger.info(`Error email sent to ${email} for ${postDoc.platform} post: ${postDoc.title}`);
    } catch (emailError) {
        logger.error('Failed to send error email:', emailError.message);
    }
};

async function publishOne(postDoc) {
    // videoUrl/thumbnailUrl are the public Cloudinary URLs saved at
    // generation time (see pipeline.service.js) — never the local disk path.
    if (postDoc.platform === "youtube") {
        return postVideoToYoutube({
            title: postDoc.title,
            description: postDoc.description,
            videoUrl: postDoc.videoUrl,
            thumbnail: postDoc.thumbnailUrl,
            tags: postDoc.tags,
        });
    }

    if (postDoc.platform === "instagram") {
        return postReelToInstagram({
            caption: postDoc.description,
            videoUrl: postDoc.videoUrl,
            thumbnail: postDoc.thumbnailUrl,
        });
    }

    throw new Error(`Unknown platform: ${postDoc.platform}`);
}

/**
 * Attempts to publish one queued post, retrying a small number of times
 * in-process (recursive) before deferring to the next cron tick.
 */
async function processWithRetry(postDoc, attemptsLeft = IMMEDIATE_RETRIES) {
    postDoc.status = "posting";
    postDoc.attempts += 1;
    await postDoc.save();

    try {
        const result = await publishOne(postDoc);
        postDoc.status = "posted";
        postDoc.platformPostId = result?.id || result?.data?.id || null;
        postDoc.postedAt = new Date();
        postDoc.lastError = null;
        await postDoc.save();
        logger.success(`Posted [${postDoc.platform}] "${postDoc.title}"`);
        
        // Send success email
        await sendSuccessEmail(postDoc, result);
        return true;
    } catch (error) {
        logger.warn(`Post attempt failed [${postDoc.platform}] "${postDoc.title}": ${error.message}`);
        postDoc.lastError = error.message;

        if (attemptsLeft > 0) {
            await postDoc.save();
            return processWithRetry(postDoc, attemptsLeft - 1);
        }

        postDoc.status = postDoc.attempts >= postDoc.maxAttempts ? "failed" : "queued";
        await postDoc.save();
        
        // Send error email when post fails and retries are exhausted
        if (postDoc.status === "failed") {
            await sendErrorEmail(postDoc, error);
        }
        
        return false;
    }
}

export async function runPostWorker() {
    const pending = await PostQueue.find({
        $or: [
            { status: "queued" },
            { status: "failed", $expr: { $lt: ["$attempts", "$maxAttempts"] } },
        ],
    }).sort({ createdAt: 1 });

    if (pending.length === 0) {
        logger.info("Post worker: nothing to post right now.");
        return;
    }

    logger.info(`Post worker: processing ${pending.length} queued post(s)`);

    for (const postDoc of pending) {
        await processWithRetry(postDoc);
    }
}

export function schedulePostWorker() {
    cron.schedule(CRON_EXPRESSION, runPostWorker);
    logger.info(`📮 Post worker scheduled: "${CRON_EXPRESSION}"`);
}