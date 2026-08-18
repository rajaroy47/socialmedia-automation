import cron from "node-cron";
import { generateVideoForTopic } from "../services/pipeline.service.js";
import {
  getNextPendingTopic,
  markTopicCompleted,
  markTopicCancelled,
} from "../services/topic.service.js";

import PostQueue from "../models/post.model.js";
import Admin from "../models/admin.model.js";

import { logger } from "../utils/logger.js";
import sendEmail from "../services/sendEmail.service.js";

import dotenv from "dotenv";
dotenv.config();

// Default cron expression (fallback)
const DEFAULT_CRON_EXPRESSION = "12 16 * * *"; // 4:12 PM daily

// Store the scheduled job reference
let scheduledJob = null;
let currentCronExpression = DEFAULT_CRON_EXPRESSION;

// ============================================================
// GET NOTIFICATION EMAIL
// ============================================================

const getNotificationEmail = () => {
  return (
    process.env.NOTIFICATION_EMAIL ||
    process.env.SMTP_USER ||
    "admin@example.com"
  );
};

// ============================================================
// GET ADMIN SETTINGS
// ============================================================

async function getAdminSettings() {
  try {
    const admin = await Admin.findOne({});
    if (!admin) {
      logger.warn("No admin found in database, using default settings");
      return {
        postToFacebook: false,
        postToInstagram: false,
        postToYouTube: false,
        dailySceduleTimeCron: DEFAULT_CRON_EXPRESSION
      };
    }
    return admin;
  } catch (error) {
    logger.error("Error fetching admin settings:", error.message);
    return {
      postToFacebook: false,
      postToInstagram: false,
      postToYouTube: false,
      dailySceduleTimeCron: DEFAULT_CRON_EXPRESSION
    };
  }
}

// ============================================================
// GET CRON EXPRESSION FROM DATABASE
// ============================================================

async function getCronExpressionFromDB() {
  try {
    const admin = await Admin.findOne({});
    if (admin && admin.dailySceduleTimeCron) {
      logger.info(`📅 Using cron from database: ${admin.dailySceduleTimeCron}`);
      return admin.dailySceduleTimeCron;
    }
    logger.info(`📅 Using default cron: ${DEFAULT_CRON_EXPRESSION}`);
    return DEFAULT_CRON_EXPRESSION;
  } catch (error) {
    logger.error("Error fetching cron from database:", error.message);
    return DEFAULT_CRON_EXPRESSION;
  }
}

// ============================================================
// SEND DAILY JOB SUCCESS EMAIL
// ============================================================

const sendDailyJobSummary = async (topicDoc, result, postsQueued) => {
  const email = getNotificationEmail();

  const subject = `📅 Daily Video Generation Complete: ${topicDoc.topicName}`;

  const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">

            <h2 style="color: #4CAF50;">
                📅 Daily Video Generation Complete
            </h2>

            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">

                <p>
                    <strong>Topic:</strong>
                    ${topicDoc.topicName}
                </p>

                <p>
                    <strong>Generated At:</strong>
                    ${new Date().toISOString()}
                </p>

                <p>
                    <strong>Posts Queued:</strong>
                    ${postsQueued.length}
                </p>

            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-radius: 5px;">

                <h3 style="color: #1976D2;">
                    🎬 Generated Video Details
                </h3>

                <p>
                    <strong>Title:</strong>
                    ${result.title}
                </p>

                <p>
                    <strong>Description:</strong>
                    ${result.description || "N/A"}
                </p>

                <p>
                    <strong>Tags:</strong>
                    ${
                      Array.isArray(result.tags)
                        ? result.tags.join(", ")
                        : "N/A"
                    }
                </p>

                <p>
                    <strong>Video URL:</strong>
                    <a href="${result.videoUrl}" target="_blank">
                        View Video
                    </a>
                </p>

                ${
                  result.thumbnailUrl
                    ? `
                            <p>
                                <strong>Thumbnail:</strong>
                                <a href="${result.thumbnailUrl}" target="_blank">
                                    View Thumbnail
                                </a>
                            </p>
                        `
                    : ""
                }

            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #e8f5e9; border-radius: 5px;">

                <h3 style="color: #2E7D32;">
                    📋 Queued Posts
                </h3>

                <ul>
                    ${
                      postsQueued.length > 0
                        ? postsQueued
                            .map(
                              (post) => `
                                        <li>
                                            <strong>
                                                ${post.platform}
                                            </strong>
                                            -
                                            ${post.contentType || "video"}
                                            ${
                                              post.status === "queued"
                                                ? "✅"
                                                : "❌"
                                            }
                                        </li>
                                    `,
                            )
                            .join("")
                        : `
                                <li>
                                    No social media posts were queued.
                                </li>
                            `
                    }
                </ul>

                <p style="margin-top: 10px; color: #666; font-size: 12px;">
                    The post worker will publish queued posts automatically.
                </p>

            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px;">

                <h3 style="color: #e65100;">
                    📌 Next Steps
                </h3>

                <ul>
                    <li>
                        Monitor the post worker logs for publishing status
                    </li>

                    <li>
                        Check the platform for the published content
                    </li>

                    <li>
                        Verify video quality and engagement
                    </li>
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
    logger.error("Failed to send daily job summary email:", error.message);
  }
};

// ============================================================
// SEND DAILY JOB ERROR EMAIL
// ============================================================

const sendDailyJobError = async (topicDoc, error) => {
  const email = getNotificationEmail();

  const subject = `❌ Daily Video Generation Failed: ${topicDoc.topicName}`;

  const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">

            <h2 style="color: #f44336;">
                ❌ Daily Video Generation Failed
            </h2>

            <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px; border-left: 4px solid #f44336;">

                <h3 style="color: #d32f2f;">
                    Error Details
                </h3>

                <p>
                    <strong>Error Message:</strong>
                    ${error.message}
                </p>

                <p>
                    <strong>Timestamp:</strong>
                    ${new Date().toISOString()}
                </p>

                <p>
                    <strong>Topic:</strong>
                    ${topicDoc.topicName}
                </p>

                ${
                  error.stack
                    ? `
                            <details>
                                <summary style="cursor: pointer; color: #1976D2;">
                                    View Stack Trace
                                </summary>

                                <pre style="background: #fff; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 12px; margin-top: 10px;">
${error.stack}
                                </pre>
                            </details>
                        `
                    : ""
                }

            </div>

            <div style="margin: 20px 0; padding: 15px; background-color: #ffebee; border-radius: 5px;">

                <h3 style="color: #c62828;">
                    ⚠️ Action Required
                </h3>

                <p>
                    Please check the following:
                </p>

                <ul>
                    <li>
                        Verify the topic "${topicDoc.topicName}" is valid
                    </li>

                    <li>
                        Check if the video generation pipeline is working
                    </li>

                    <li>
                        Verify Cloudinary credentials and storage
                    </li>

                    <li>
                        Check if the topic has enough content to generate a video
                    </li>

                    <li>
                        Review the video generation logs for more details
                    </li>
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
    logger.error("Failed to send daily job error email:", emailError.message);
  }
};

// ============================================================
// SEND NO TOPICS AVAILABLE EMAIL
// ============================================================

const sendNoTopicsEmail = async () => {
  const email = getNotificationEmail();

  const subject = "⚠️ Daily Video Job: No Topics Available";

  const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">

            <h2 style="color: #ff9800;">
                ⚠️ Daily Video Job: No Topics Available
            </h2>

            <p>
                The daily video job was triggered but no pending topics were found in the queue.
            </p>

            <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                <p>
                    <strong>Time:</strong>
                    ${new Date().toISOString()}
                </p>

                <p>
                    <strong>Status:</strong>
                    Skipped
                </p>
            </div>

            <p>
                Please add more topics to VideoTopic collection to continue daily video generation.
            </p>

            <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />

            <p style="color: #666; font-size: 12px;">
                This is an automated notification from your Daily Video Generation System.
            </p>

        </div>
    `;

  try {
    await sendEmail(email, subject, body);
  } catch (error) {
    logger.error("Failed to send no-topics notification email:", error.message);
  }
};

// ============================================================
// DAILY VIDEO JOB
// ============================================================

export async function runDailyVideoJob() {
  logger.info("⏰ Daily video job triggered");

  let topicDoc = null;

  try {
    // ====================================================
    // 1. GET ADMIN SETTINGS FROM DATABASE
    // ====================================================

    const admin = await Admin.findOne({});

    if (!admin) {
      throw new Error("Admin configuration not found in database");
    }

    // ====================================================
    // 2. GET PLATFORM SETTINGS FROM DATABASE
    // ====================================================

    const postToInstagram = admin.postToInstagram === true;
    const postToYouTube = admin.postToYouTube === true;
    const postToFacebook = admin.postToFacebook === true;

    logger.info(
      `📱 Platform settings from DB -> ` +
        `YouTube=${postToYouTube}, ` +
        `Instagram=${postToInstagram}, ` +
        `Facebook=${postToFacebook}`
    );

    // ====================================================
    // 3. GET NEXT TOPIC
    // ====================================================

    topicDoc = await getNextPendingTopic();

    if (!topicDoc) {
      logger.warn(
        "Daily video job skipped: topic queue is empty. Add more topics to VideoTopic."
      );

      await sendNoTopicsEmail();
      return;
    }

    // ====================================================
    // 4. GENERATE VIDEO
    // ====================================================

    const result = await generateVideoForTopic(topicDoc.topicName);

    // ====================================================
    // 5. QUEUE POSTS
    // ====================================================

    const queuedPosts = [];

    // YOUTUBE
    if (postToYouTube) {
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

      queuedPosts.push(youtubePost);
      logger.info("▶️ YouTube post queued");
    }

    // INSTAGRAM
    if (postToInstagram) {
      const caption =
        `${result.description}\n\n${(result.hashtags || []).join(" ")}`.trim();

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
      logger.info("📸 Instagram post queued");
    }

    // FACEBOOK
    if (postToFacebook) {
      const facebookPost = await PostQueue.create({
        topic: topicDoc._id,
        platform: "facebook",
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

      queuedPosts.push(facebookPost);
      logger.info("📘 Facebook post queued");
    }

    // ====================================================
    // 6. MARK TOPIC COMPLETED
    // ====================================================

    await markTopicCompleted(topicDoc._id, result.videoPath);

    logger.success(
      `Daily video job done for "${topicDoc.topicName}". ` +
        `${queuedPosts.length} post(s) queued for worker.`
    );

    // ====================================================
    // 7. SEND SUCCESS EMAIL
    // ====================================================

    await sendDailyJobSummary(topicDoc, result, queuedPosts);

  } catch (error) {
    logger.error(`Daily video job failed:`, error.message);
    logger.error(error.stack || error);

    if (topicDoc) {
      await sendDailyJobError(topicDoc, error);
    } else {
      // Send generic error email
      const email = getNotificationEmail();
      const subject = "❌ Daily Video Job Failed - Critical Error";
      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #f44336;">❌ Daily Video Job Failed</h2>
          <div style="margin: 20px 0; padding: 15px; background-color: #fff3e0; border-radius: 5px; border-left: 4px solid #f44336;">
            <p><strong>Error Message:</strong> ${error.message}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <p>Please check the server logs for more details.</p>
          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">This is an automated error notification.</p>
        </div>
      `;
      
      try {
        await sendEmail(email, subject, body);
      } catch (emailError) {
        logger.error("Failed to send generic error email:", emailError.message);
      }
    }
  }
}

// ============================================================
// SCHEDULE DAILY VIDEO JOB
// ============================================================

export async function scheduleDailyVideoJob() {
  try {
    // Get the cron expression from database
    const cronExpression = await getCronExpressionFromDB();
    
    // Stop existing job if running
    if (scheduledJob) {
      scheduledJob.stop();
      logger.info("🛑 Stopped existing scheduled job");
    }

    // Schedule the new job
    scheduledJob = cron.schedule(cronExpression, runDailyVideoJob);
    currentCronExpression = cronExpression;
    
    logger.info(`✅ Daily video job scheduled successfully: "${cronExpression}"`);
    logger.info(`⏰ Next run will be at: ${getNextRunTime(cronExpression)}`);
    
    return { success: true, cronExpression };
  } catch (error) {
    logger.error("Failed to schedule daily video job:", error.message);
    
    // Fallback to default cron
    if (scheduledJob) {
      scheduledJob.stop();
    }
    scheduledJob = cron.schedule(DEFAULT_CRON_EXPRESSION, runDailyVideoJob);
    currentCronExpression = DEFAULT_CRON_EXPRESSION;
    logger.info(`📅 Daily video job scheduled (fallback): "${DEFAULT_CRON_EXPRESSION}"`);
    
    return { success: false, error: error.message, cronExpression: DEFAULT_CRON_EXPRESSION };
  }
}

// ============================================================
// RESCHEDULE DAILY VIDEO JOB (for admin updates)
// ============================================================

export async function rescheduleDailyVideoJob() {
  logger.info("🔄 Rescheduling daily video job...");
  
  try {
    // Get the latest cron from database
    const admin = await Admin.findOne({});
    let cronExpression = DEFAULT_CRON_EXPRESSION;
    
    if (admin && admin.dailySceduleTimeCron) {
      cronExpression = admin.dailySceduleTimeCron;
    }

    // Stop existing job
    if (scheduledJob) {
      scheduledJob.stop();
      logger.info("🛑 Stopped existing scheduled job for reschedule");
      scheduledJob = null;
    }

    // Start new job
    scheduledJob = cron.schedule(cronExpression, runDailyVideoJob);
    currentCronExpression = cronExpression;
    
    logger.info(`✅ Daily video job rescheduled successfully: "${cronExpression}"`);
    logger.info(`⏰ Next run will be at: ${getNextRunTime(cronExpression)}`);
    
    // Also update the .env file to keep it in sync (optional)
    try {
      // You can optionally update process.env here
      process.env.DAILY_VIDEO_CRON = cronExpression;
    } catch (envError) {
      // Silent fail
    }
    
    return { success: true, cronExpression };
  } catch (error) {
    logger.error("Failed to reschedule daily video job:", error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// GET NEXT RUN TIME (for logging)
// ============================================================

function getNextRunTime(cronExpression) {
  try {
    // Simple calculation - this is approximate
    const parts = cronExpression.split(' ');
    if (parts.length >= 2) {
      const minute = parts[0];
      const hour = parts[1];
      const now = new Date();
      let nextRun = new Date(now);
      nextRun.setHours(parseInt(hour), parseInt(minute), 0, 0);
      
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      return nextRun.toLocaleString();
    }
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

// ============================================================
// GET CURRENT SCHEDULE INFO
// ============================================================

export async function getCurrentSchedule() {
  try {
    const admin = await Admin.findOne({});
    let cronExpression = DEFAULT_CRON_EXPRESSION;
    let timeString = "16:12";
    
    if (admin && admin.dailySceduleTimeCron) {
      cronExpression = admin.dailySceduleTimeCron;
      const parts = cronExpression.split(' ');
      if (parts.length >= 2) {
        const minute = parts[0];
        const hour = parts[1];
        timeString = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      }
    }

    return {
      cronExpression,
      timeString,
      isScheduled: !!scheduledJob,
      isRunning: !!scheduledJob
    };
  } catch (error) {
    logger.error("Failed to get current schedule:", error.message);
    return {
      cronExpression: DEFAULT_CRON_EXPRESSION,
      timeString: "16:12",
      isScheduled: false,
      isRunning: false
    };
  }
}