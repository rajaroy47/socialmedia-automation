// src/config/db.config.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/social-automation";

export async function connectDB() {
    try {
        mongoose.set("strictQuery", true);
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
        logger.success(`MongoDB connected -> ${mongoose.connection.name}`);
    } catch (error) {
        logger.error("MongoDB connection failed:", error.message);
        // Don't crash the whole server if DB is briefly unreachable on boot —
        // routes that need it will surface a clear error instead.
        throw error;
    }
}

mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
});

export default connectDB;
