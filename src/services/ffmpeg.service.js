// src/services/ffmpeg.service.js - 9:16 Shorts assembly with Ken Burns zoom effects

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger.js";
import { GENERATED_DIR, BG_MUSIC_DIR } from "../config/paths.config.js";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const TRANSITION_DURATION = 0.8;
const IMAGE_DISPLAY_DURATION = 3.5;

export function getDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

/**
 * Picks a random background-music track from public/uploads/bg-music.
 */
export function getRandomBackgroundMusic() {
    if (!fs.existsSync(BG_MUSIC_DIR)) return null;

    const musicFiles = fs
        .readdirSync(BG_MUSIC_DIR)
        .filter((f) => /\.(mp3|wav|m4a|aac)$/i.test(f));

    if (musicFiles.length === 0) return null;

    const chosen = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    return path.join(BG_MUSIC_DIR, chosen);
}

/**
 * Mixes the voiceover with a dimmed background music bed. Falls back to the
 * voiceover alone if mixing fails for any reason (missing ffmpeg codec etc.)
 * so a music problem never blocks the whole pipeline.
 */
export async function mixAudioWithBackgroundMusic(voiceoverPath, bgMusicPath, outputPath) {
    return new Promise((resolve) => {
        const absVoice = path.resolve(voiceoverPath);
        const absMusic = path.resolve(bgMusicPath);
        const absOut = path.resolve(outputPath);

        getDuration(absVoice)
            .catch(() => 30)
            .then((rawDuration) => {
                // BUG FOUND: `duration || 30` does NOT catch every bad
                // value ffprobe can return. If ffprobe can't determine a
                // file's length (which happens for some MP3s saved from
                // streamed API responses, like ElevenLabs' output), it
                // reports the string "N/A" instead of a number — and "N/A"
                // is truthy, so the old fallback let it straight through.
                // `Math.max(1, "N/A")` then evaluates to NaN, and
                // `NaN.toFixed(3)` produces the literal string "NaN",
                // which got embedded directly into the ffmpeg command as
                // `atrim=0:NaN` and `-t NaN` — invalid arguments, which is
                // exactly the EINVAL / "4294967274" crash you saw. Fixed by
                // explicitly validating the value is a finite, positive
                // number before using it anywhere.
                const parsed = Number(rawDuration);
                const safeDuration = Number.isFinite(parsed) && parsed > 0 ? Math.max(1, parsed) : 30;

                if (!Number.isFinite(parsed) || parsed <= 0) {
                    logger.warn(
                        `Voiceover duration was unreadable (ffprobe returned "${rawDuration}") — using 30s fallback for the music mix.`
                    );
                }

                // Cap the fade length so it can never exceed half the
                // clip (avoids overlapping in/out fades on very short
                // narration, which some ffmpeg builds reject).
                const fadeDuration = Math.min(2, safeDuration / 2);
                const fadeOutStart = Math.max(0, safeDuration - fadeDuration);

                // NOTE: this used to be built with `.audioFilters([...])`
                // (a *simple* filtergraph, i.e. `-af`), which only ever
                // applies to a single stream — invalid with two separate
                // inputs (voice + music) feeding an `amix`. It also used
                // the `aloop` filter with a huge `size=2e9` sample buffer
                // plus newer `amix` sub-options (`dropout_transition`,
                // `normalize`) that aren't reliably supported across every
                // ffmpeg build — that combination is what was throwing
                // "ffmpeg exited with code 4294967274" (that huge number is
                // just -22 / EINVAL reported as an unsigned 32-bit code).
                //
                // Fixed by: (1) using `-filter_complex` with proper labeled
                // pads instead of `-af`, and (2) looping the music at the
                // input/demuxer level with `-stream_loop -1` instead of the
                // memory-heavy `aloop` filter, and (3) sticking to the
                // plain, long-supported `amix=inputs=2:duration=first`.
                ffmpeg()
                    .input(absVoice)
                    .input(absMusic)
                    .inputOptions(["-stream_loop", "-1"])
                    .complexFilter([
                        `[1:a]atrim=0:${safeDuration.toFixed(3)},volume=0.45,` +
                        `afade=t=in:ss=0:d=${fadeDuration.toFixed(3)},` +
                        `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}[bg]`,
                        `[0:a][bg]amix=inputs=2:duration=first[aout]`,
                    ])
                    .outputOptions([
                        "-map", "[aout]",
                        "-ac", "2",
                        "-c:a", "aac",
                        "-b:a", "192k",
                        "-t", safeDuration.toFixed(3),
                    ])
                    .on("end", () => {
                        logger.success(`Audio mixed: ${path.basename(absOut)}`);
                        resolve(absOut);
                    })
                    .on("error", (err) => {
                        logger.warn("Audio mix failed, falling back to voiceover only:", err.message);
                        fs.copyFileSync(absVoice, absOut);
                        resolve(absOut);
                    })
                    .save(absOut);
            });
    });
}

/**
 * Builds the final 9:16 Shorts/Reels video: Ken Burns zoom on each scene
 * image, crossfade transitions, fade in/out, synced to the narration length.
 */
export async function createProfessionalVideo(images, audioPath, outputName) {
    if (!images || images.length === 0) {
        throw new Error("At least one image is required");
    }

    const outputPath = path.join(GENERATED_DIR.videos, outputName || `video_${Date.now()}.mp4`);

    const rawAudioDuration = await getDuration(audioPath);
    const parsedAudioDuration = Number(rawAudioDuration);
    const audioDuration =
        Number.isFinite(parsedAudioDuration) && parsedAudioDuration > 0 ? parsedAudioDuration : 30;

    if (!Number.isFinite(parsedAudioDuration) || parsedAudioDuration <= 0) {
        logger.warn(
            `Narration duration was unreadable (ffprobe returned "${rawAudioDuration}") — using 30s fallback for video timing.`
        );
    }

    const n = images.length;

    let clipDuration = Math.max(
        IMAGE_DISPLAY_DURATION,
        (audioDuration + (n - 1) * TRANSITION_DURATION) / n
    );
    let transitionDuration = Math.min(TRANSITION_DURATION, clipDuration * 0.3);

    logger.info(
        `Rendering ${n}-scene 9:16 video, audio ${audioDuration.toFixed(1)}s, clip ${clipDuration.toFixed(1)}s`
    );

    return new Promise((resolve, reject) => {
        let command = ffmpeg();

        images.forEach((img) => {
            command.input(path.resolve(img)).inputOptions(["-loop 1", "-t", clipDuration.toFixed(3)]);
        });
        command.input(path.resolve(audioPath));

        const filters = [];
        const videoLabels = [];

        images.forEach((img, i) => {
            const zoomStyle = i % 4;
            let zoomExpr;
            switch (zoomStyle) {
                case 0:
                    zoomExpr = `min(zoom+0.0015,1.25)`;
                    break;
                case 1:
                    zoomExpr = `if(eq(on,1),1.25,max(zoom-0.0015,1.0))`;
                    break;
                case 2:
                    zoomExpr = `min(zoom+0.003,1.35)`;
                    break;
                default:
                    zoomExpr = `if(eq(on,1),1.35,max(zoom-0.003,1.0))`;
            }

            const framesPerClip = Math.max(1, Math.round(clipDuration * FPS));

            filters.push({
                filter: "scale",
                options: `${WIDTH * 2}:${HEIGHT * 2}:force_original_aspect_ratio=increase`,
                inputs: `${i}:v`,
                outputs: `sc${i}`,
            });
            filters.push({
                filter: "crop",
                options: `${WIDTH * 2}:${HEIGHT * 2}`,
                inputs: `sc${i}`,
                outputs: `cr${i}`,
            });
            filters.push({
                filter: "zoompan",
                options: { z: zoomExpr, d: framesPerClip, s: `${WIDTH}x${HEIGHT}`, fps: FPS },
                inputs: `cr${i}`,
                outputs: `zp${i}`,
            });
            filters.push({ filter: "setsar", options: "1", inputs: `zp${i}`, outputs: `v${i}` });

            videoLabels.push(`v${i}`);
        });

        let lastLabel = videoLabels[0];
        let cumulative = clipDuration;

        for (let i = 1; i < n; i++) {
            const outLabel = i === n - 1 ? "vout" : `xf${i}`;
            const offset = Math.max(0, cumulative - transitionDuration);

            filters.push({
                filter: "xfade",
                options: {
                    transition: "fade",
                    duration: transitionDuration.toFixed(3),
                    offset: offset.toFixed(3),
                },
                inputs: [lastLabel, videoLabels[i]],
                outputs: outLabel,
            });

            cumulative = cumulative + clipDuration - transitionDuration;
            lastLabel = outLabel;
        }

        const preFadeLabel = n === 1 ? videoLabels[0] : lastLabel;
        const totalDuration = n === 1 ? clipDuration : cumulative;
        const fadeOutStart = Math.max(0, totalDuration - 0.5);

        filters.push({
            filter: "fade",
            options: { type: "in", start_time: 0, duration: 0.3 },
            inputs: preFadeLabel,
            outputs: "fadein",
        });
        filters.push({
            filter: "fade",
            options: { type: "out", start_time: fadeOutStart.toFixed(3), duration: 0.5 },
            inputs: "fadein",
            outputs: "final",
        });

        command
            .complexFilter(filters)
            .outputOptions([
                "-map [final]",
                `-map ${n}:a`,
                "-c:v libx264",
                "-preset medium",
                "-crf 18",
                "-pix_fmt yuv420p",
                "-c:a aac",
                "-b:a 128k",
                "-movflags +faststart",
                "-threads 0",
                "-t", audioDuration.toFixed(3),
                "-r", "30",
                "-g", "30",
                "-aspect", "9:16",
            ])
            .on("end", () => {
                logger.success(`Video rendered: ${outputPath}`);
                resolve(outputPath);
            })
            .on("error", (err, _stdout, stderr) => {
                logger.error("FFmpeg render error:", err.message, stderr);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Extracts a still frame (the first scene image works best, but if you
 * pass a video path it grabs frame 1) and saves it as a JPEG thumbnail
 * for YouTube's custom thumbnail slot.
 */
export async function generateThumbnail(sourceImagePath, outputName) {
    const outputPath = path.join(GENERATED_DIR.thumbnails, outputName || `thumb_${Date.now()}.jpg`);

    return new Promise((resolve, reject) => {
        ffmpeg(sourceImagePath)
            .outputOptions(["-vframes 1", "-q:v 2"])
            .size(`${WIDTH}x${HEIGHT}`)
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(err))
            .save(outputPath);
    });
}
