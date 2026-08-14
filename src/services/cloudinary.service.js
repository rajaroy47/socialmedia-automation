// src/services/cloudinary.service.js
//
// Zernio needs a publicly reachable URL for media, not a local file path.
// This uploads the rendered video/thumbnail to Cloudinary right after
// generation and returns the public https:// URL to post with.

import cloudinary from "../config/cloudinary.config.js";
import { logger } from "../utils/logger.js";

/**
 * Uploads a local video file to Cloudinary. Uses upload_large so it works
 * for both small and multi-hundred-MB files via chunked upload.
 */
export async function uploadVideoToCloudinary(localPath, folder = "social-automation/videos") {
    logger.info(`Uploading video to Cloudinary: ${localPath}`);

    const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_large(
            localPath,
            {
                resource_type: "video",
                folder,
                chunk_size: 20 * 1024 * 1024, // 20MB chunks
            },
            (error, uploadResult) => {
                if (error) return reject(error);
                resolve(uploadResult);
            }
        );
    });

    logger.success(`Video uploaded: ${result.secure_url}`);
    return result.secure_url;
}

/**
 * Uploads a local image (thumbnail) to Cloudinary.
 */
export async function uploadImageToCloudinary(localPath, folder = "social-automation/thumbnails") {
    logger.info(`Uploading thumbnail to Cloudinary: ${localPath}`);

    const result = await cloudinary.uploader.upload(localPath, {
        resource_type: "image",
        folder,
    });

    logger.success(`Thumbnail uploaded: ${result.secure_url}`);
    return result.secure_url;
}
