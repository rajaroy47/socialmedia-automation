// src/services/huggingface.service.js
//
// Generates 9:16 scene images with FLUX.1-schnell. Reads up to 10
// HUGGINGFACE_API_KEY_1..10 keys from .env and, if one comes back with a
// quota/rate-limit error, automatically retries the same request on the
// next key — recursively — until one succeeds or every key is exhausted.

import { InferenceClient } from "@huggingface/inference";
import sharp from "sharp";
import { runWithKeyRotation } from "../utils/keyRotator.js";
import { logger } from "../utils/logger.js";

const MAX_KEYS = 10;
const IMAGE_MODEL = process.env.HUGGINGFACE_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";

function getHuggingFaceKeys() {
    const keys = [];
    for (let i = 1; i <= MAX_KEYS; i++) {
        keys.push(process.env[`HUGGINGFACE_API_KEY_${i}`]);
    }
    return keys;
}

/**
 * Crop/resize an arbitrary image buffer to a clean 1080x1920 (9:16) frame.
 */
export async function resizeToNineSixteen(imageBuffer) {
    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        const targetWidth = 1080;
        const targetHeight = 1920;
        const targetRatio = targetWidth / targetHeight;
        const currentRatio = width / height;

        let processedBuffer;

        if (Math.abs(currentRatio - targetRatio) < 0.01) {
            processedBuffer = await sharp(imageBuffer)
                .resize(targetWidth, targetHeight, { fit: "fill", kernel: "lanczos3" })
                .toBuffer();
        } else if (currentRatio > targetRatio) {
            const cropWidth = Math.round(height * targetRatio);
            const offsetX = Math.round((width - cropWidth) / 2);
            processedBuffer = await sharp(imageBuffer)
                .extract({ left: offsetX, top: 0, width: cropWidth, height })
                .resize(targetWidth, targetHeight, { fit: "fill", kernel: "lanczos3" })
                .toBuffer();
        } else {
            const cropHeight = Math.round(width / targetRatio);
            const offsetY = Math.round((height - cropHeight) / 2);
            processedBuffer = await sharp(imageBuffer)
                .extract({ left: 0, top: offsetY, width, height: cropHeight })
                .resize(targetWidth, targetHeight, { fit: "fill", kernel: "lanczos3" })
                .toBuffer();
        }

        return processedBuffer;
    } catch (error) {
        logger.warn("Image resize failed, using original buffer:", error.message);
        return imageBuffer;
    }
}

/**
 * Generate one 9:16 scene image, rotating through every configured
 * HuggingFace key until one works.
 */
export async function generateSceneImage(prompt, sceneNumber = 1) {
    const enhancedPrompt = `${prompt}, vertical portrait orientation, 9:16 aspect ratio, mobile wallpaper style, vertical composition, tall format, professional cinematography, 4k, highly detailed, photorealistic`;

    const buffer = await runWithKeyRotation({
        providerName: "HuggingFace",
        keys: getHuggingFaceKeys(),
        taskFn: async (apiKey) => {
            const client = new InferenceClient(apiKey);
            const blob = await client.textToImage({
                model: IMAGE_MODEL,
                inputs: enhancedPrompt,
                parameters: {
                    width: 1080,
                    height: 1920,
                    aspect_ratio: "9:16",
                },
            });
            return Buffer.from(await blob.arrayBuffer());
        },
    });

    logger.success(`Scene ${sceneNumber} image generated (${buffer.length} bytes)`);
    return resizeToNineSixteen(buffer);
}
