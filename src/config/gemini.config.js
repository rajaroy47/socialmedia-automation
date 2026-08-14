// src/config/gemini.config.js

import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger.js";

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
    logger.error("GOOGLE_API_KEY is not set in .env");
    process.exit(1);
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const genAI = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

export default genAI;
