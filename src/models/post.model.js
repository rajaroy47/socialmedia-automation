import mongoose from "mongoose";

// Every time a video finishes rendering, one PostQueue document is created
// per target platform (YouTube always, Instagram optionally). The posting
// worker (src/jobs/postWorker.job.js) polls this collection on its own cron
// schedule and actually pushes the content out via Zernio, independently
// from the generation job. This is what lets "generate" and "post" scale /
// fail independently and gives you automatic retries.
const postQueueSchema = new mongoose.Schema(
    {
        topic: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VideoTopic",
        },

        platform: {
            type: String,
            enum: ["youtube", "instagram"],
            required: true,
        },

        // For Instagram: "reel" or "story". Ignored for YouTube.
        contentType: {
            type: String,
            enum: ["video", "reel", "story"],
            default: "video",
        },

        // Local disk paths — kept for tracing/debugging only, never sent to Zernio.
        videoPath: { type: String, required: true },
        thumbnailPath: { type: String, default: null },

        // Public Cloudinary URLs — these are what actually get posted, since
        // Zernio refuses localhost/private-network URLs.
        videoUrl: { type: String, required: true },
        thumbnailUrl: { type: String, default: null },

        title: { type: String, required: true },
        description: { type: String, required: true },
        tags: { type: [String], default: [] },

        status: {
            type: String,
            enum: ["queued", "posting", "posted", "failed"],
            default: "queued",
        },

        attempts: { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 5 },
        lastError: { type: String, default: null },

        // Filled in once Zernio confirms the post.
        platformPostId: { type: String, default: null },
        postedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

postQueueSchema.index({ status: 1, createdAt: 1 });

const PostQueue = mongoose.model("PostQueue", postQueueSchema);

export default PostQueue;
