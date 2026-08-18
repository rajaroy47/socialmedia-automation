// src/models/admin.model.js

import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        role: {
            type: String,
            enum: ["admin"],
            default: "admin",
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        dailySceduleTimeCron: {
            type: String,
            default: "12 16 * * *",
        },
        postToInstagram: {
            type: Boolean,
            default: false,
        },
        postToYouTube: {
            type: Boolean,
            default: false,
        },
        postToFacebook: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

// Never leak the hash if a document is accidentally serialized.
adminSchema.set("toJSON", {
    transform: (_doc, ret) => {
        delete ret.passwordHash;
        return ret;
    },
});

export default mongoose.model("Admin", adminSchema);