// src/middlewares/auth.middleware.js

import { verifyToken } from "../services/auth.service.js";

/**
 * Protects a route: requires a valid "Authorization: Bearer <token>" header.
 * On success, attaches the decoded payload to req.admin.
 */
export function protect(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ success: false, error: "Not authenticated. Please log in." });
    }

    try {
        req.admin = verifyToken(token);
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: "Session expired or invalid. Please log in again." });
    }
}
