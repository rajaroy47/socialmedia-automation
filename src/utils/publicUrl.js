// src/utils/publicUrl.js
//
// Zernio (like every social API) needs a publicly reachable URL for media,
// not a local file path. server.js exposes /generatedOutput as a static
// route, so BASE_URL just needs to point at wherever this server is
// reachable from the internet (e.g. your domain, or an ngrok/tunnel URL
// while testing locally).

import path from "path";
import { SERVER_ROOT } from "../config/paths.config.js";

export function toPublicUrl(absoluteFilePath) {
    const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, "");
    const relative = path.relative(SERVER_ROOT, absoluteFilePath).split(path.sep).join("/");
    return `${baseUrl}/${relative}`;
}