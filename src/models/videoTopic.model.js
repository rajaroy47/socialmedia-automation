import mongoose from "mongoose";

// A simple ordered queue of topics. The daily cron job always picks the
// lowest `order` value with status "pending", generates a video for it,
// then flips it to "completed" (or "cancelled" if generation fails and you
// want to skip it manually).
const videoTopicSchema = new mongoose.Schema(
    {
        topicName: {
            type: String,
            required: true,
            trim: true,
        },

        order: {
            type: Number,
            required: true,
            unique: true,
            min: 1,
        },

        status: {
            type: String,
            enum: ["pending", "completed", "cancelled"],
            default: "pending",
        },

        // Filled in once a video has been generated for this topic, so you
        // can trace which video/post came from which topic.
        lastVideoPath: {
            type: String,
            default: null,
        },

        completedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

videoTopicSchema.index({ status: 1, order: 1 });

const VideoTopic = mongoose.model("VideoTopic", videoTopicSchema);

export default VideoTopic;
