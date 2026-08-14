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
