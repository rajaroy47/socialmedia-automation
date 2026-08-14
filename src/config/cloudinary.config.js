// src/config/cloudinary.config.js

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { logger } from "../utils/logger.js";

dotenv.config();

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    logger.warn(
        "Cloudinary is not fully configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET). " +
        "Generated videos/thumbnails cannot be uploaded and posting will fail with " +
        "'local or private network address' until this is set."
    );
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

export default cloudinary;
