// src/config/paths.config.js
//
// Single source of truth for every on-disk folder the app touches, matching
// the requested layout:
//   server/public/uploads/bg-music
//   server/generatedOutput/{images,audios,videos,thumbnails}

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src/config -> server/
export const SERVER_ROOT = path.resolve(__dirname, "..", "..");

// Vercel (and most serverless platforms) deploy the project to a read-only
// filesystem — only /tmp is writable, and it's wiped between invocations.
// Detect that and redirect anything we need to *write* there instead of
// trying to mkdir inside the read-only deployment bundle (which crashes the
// whole function on boot).
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const WRITABLE_ROOT = IS_SERVERLESS ? path.join("/tmp", "social-automation") : SERVER_ROOT;

export const PUBLIC_DIR = path.join(SERVER_ROOT, "public");
export const BG_MUSIC_DIR = path.join(PUBLIC_DIR, "uploads", "bg-music");

// Where uploaded files (multer) get written. Bundled under public/ locally,
// but that's read-only on serverless, so uploads go to /tmp there instead.
export const UPLOAD_DIR = IS_SERVERLESS
    ? path.join(WRITABLE_ROOT, "uploads")
    : path.join(PUBLIC_DIR, "uploads");

export const GENERATED_ROOT = path.join(WRITABLE_ROOT, "generatedOutput");
export const GENERATED_DIR = {
    images: path.join(GENERATED_ROOT, "images"),
    audios: path.join(GENERATED_ROOT, "audios"),
    videos: path.join(GENERATED_ROOT, "videos"),
    thumbnails: path.join(GENERATED_ROOT, "thumbnails"),
};

export function ensureDirectories() {
    // BG_MUSIC_DIR ships inside the repo/deployment, so it already exists —
    // never try to mkdir it on serverless (that path is read-only there).
    const dirs = IS_SERVERLESS
        ? [UPLOAD_DIR, GENERATED_DIR.images, GENERATED_DIR.audios, GENERATED_DIR.videos, GENERATED_DIR.thumbnails]
        : [BG_MUSIC_DIR, UPLOAD_DIR, GENERATED_DIR.images, GENERATED_DIR.audios, GENERATED_DIR.videos, GENERATED_DIR.thumbnails];

    dirs.forEach((dir) => {
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
            // Never let a directory-creation failure crash the whole process —
            // log it and let whichever route actually needs that folder fail
            // with a clear error instead of taking down every request.
            console.error(`[paths.config] Could not create directory "${dir}": ${error.message}`);
        }
    });
}
