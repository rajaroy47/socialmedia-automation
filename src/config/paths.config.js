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

export const PUBLIC_DIR = path.join(SERVER_ROOT, "public");
export const BG_MUSIC_DIR = path.join(PUBLIC_DIR, "uploads", "bg-music");

export const GENERATED_ROOT = path.join(SERVER_ROOT, "generatedOutput");
export const GENERATED_DIR = {
    images: path.join(GENERATED_ROOT, "images"),
    audios: path.join(GENERATED_ROOT, "audios"),
    videos: path.join(GENERATED_ROOT, "videos"),
    thumbnails: path.join(GENERATED_ROOT, "thumbnails"),
};

export function ensureDirectories() {
    const dirs = [
        BG_MUSIC_DIR,
        GENERATED_DIR.images,
        GENERATED_DIR.audios,
        GENERATED_DIR.videos,
        GENERATED_DIR.thumbnails,
    ];
    dirs.forEach((dir) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}
