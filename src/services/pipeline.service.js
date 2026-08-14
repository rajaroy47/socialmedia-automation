// src/services/pipeline.service.js
//
// The single "generate one video end-to-end" function, used by both the
// manual /api/generate-video route and the 4pm daily cron job.

import fs from "fs";
import path from "path";
import { generateScriptAndScenes, generatePostMetadata } from "./gemini.service.js";
import { generateSceneImage } from "./huggingface.service.js";
import { generateNarration } from "./elevenlabs.service.js";
import {
    createProfessionalVideo,
    getDuration,
    getRandomBackgroundMusic,
    mixAudioWithBackgroundMusic,
    generateThumbnail,
} from "./ffmpeg.service.js";
import { uploadVideoToCloudinary, uploadImageToCloudinary } from "./cloudinary.service.js";
import { GENERATED_DIR } from "../config/paths.config.js";
import { logger } from "../utils/logger.js";

/**
 * Runs the full pipeline for one topic string and returns everything a
 * caller needs to either respond to an HTTP request or enqueue posts:
 * {
 *   videoPath, thumbnailPath,       // local disk paths (for tracing/logs)
 *   videoUrl, thumbnailUrl,         // public Cloudinary URLs (what Zernio posts)
 *   title, description, tags, hashtags, duration
 * }
 */
export async function generateVideoForTopic(topic) {
    logger.info(`\n=== Starting pipeline for topic: "${topic}" ===`);

    // 1. Script
    const script = await generateScriptAndScenes(topic);

    // 2. Scene images (sequential — each call already retries across
    //    HuggingFace keys internally, so we keep this simple rather than
    //    firing 10 parallel key-rotation storms at once).
    const imagePaths = [];
    for (const scene of script.scenes) {
        const imageData = await generateSceneImage(scene.imagePrompt, scene.sceneNumber);
        const filename = `scene_${scene.sceneNumber}_${Date.now()}.png`;
        const filePath = path.join(GENERATED_DIR.images, filename);
        fs.writeFileSync(filePath, imageData);
        imagePaths.push(filePath);
    }
    logger.success(`Generated ${imagePaths.length} scene images`);

    // 3. Narration audio
    const fullScript = script.scenes.map((s) => s.voiceover).join(" ");
    const narrationBuffer = await generateNarration(fullScript);
    const audioFilename = `narration_${Date.now()}.mp3`;
    const audioPath = path.join(GENERATED_DIR.audios, audioFilename);
    fs.writeFileSync(audioPath, narrationBuffer);

    // 4. Mix with background music (best-effort)
    let finalAudioPath = audioPath;
    const bgMusicPath = getRandomBackgroundMusic();
    if (bgMusicPath) {
        const mixedFilename = `mixed_${Date.now()}.mp3`;
        const mixedPath = path.join(GENERATED_DIR.audios, mixedFilename);
        finalAudioPath = await mixAudioWithBackgroundMusic(audioPath, bgMusicPath, mixedPath);
    } else {
        logger.warn("No background music found in public/uploads/bg-music — using voiceover only.");
    }

    // 5. Render final video
    const videoFilename = `video_${Date.now()}.mp4`;
    const videoPath = await createProfessionalVideo(imagePaths, finalAudioPath, videoFilename);
    const duration = await getDuration(finalAudioPath);

    // 6. Thumbnail (first scene image makes a good custom thumbnail)
    const thumbnailPath = await generateThumbnail(imagePaths[0], `thumb_${Date.now()}.jpg`);

    // 7. Upload video + thumbnail to Cloudinary so we have PUBLIC URLs.
    //    Zernio (and every social platform API) refuses localhost/private
    //    URLs — it has to be able to fetch the file itself over the internet.
    const videoUrl = await uploadVideoToCloudinary(videoPath);
    const thumbnailUrl = await uploadImageToCloudinary(thumbnailPath);

    // 8. Professional title/description/tags
    const metadata = await generatePostMetadata({
        topic,
        title: script.title,
        scriptText: fullScript,
    });

    logger.success(`=== Pipeline complete for "${topic}" (${duration.toFixed(1)}s) ===\n`);

    return {
        videoPath,
        thumbnailPath,
        videoUrl,
        thumbnailUrl,
        title: metadata.youtubeTitle,
        description: metadata.description,
        tags: metadata.tags,
        hashtags: metadata.hashtags,
        duration,
        scenesCount: script.scenes.length,
    };
}
