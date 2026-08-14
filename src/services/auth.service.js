// src/services/auth.service.js
//
// Handles admin credential storage/verification (bcrypt) and JWT issuing.
// The admin account itself lives in MongoDB (Admin model) — this file just
// seeds one on first boot from .env so there's always a way in, and never
// touches those values again afterwards (change the password via DB from
// then on, not via .env).

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Admin from "../models/admin.model.js";
import { logger } from "../utils/logger.js";

import dotenv from "dotenv";

dotenv.config();

const SALT_ROUNDS = 12;

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
    logger.warn(
        "JWT_SECRET is not set in .env — using a random in-memory secret. " +
        "All existing login sessions will be invalidated every time the server restarts. " +
        "Set JWT_SECRET in .env for a stable, secure setup."
    );
}
// Fallback keeps the server usable in dev, but rotates every restart.
const EFFECTIVE_SECRET = JWT_SECRET || crypto.randomBytes(48).toString("hex");

export async function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// test
// console.log(await hashPassword("raja,roy98@me"));


export async function comparePassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
}

export function generateToken(admin) {
    return jwt.sign(
        { id: admin._id.toString(), username: admin.username, email: admin.email, role: admin.role },
        EFFECTIVE_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token) {
    return jwt.verify(token, EFFECTIVE_SECRET);
}

/**
 * Verifies login credentials against the DB and returns a signed token + admin
 * profile on success. Throws an Error with a safe, generic message on failure.
 */
export async function loginAdmin(identifier, password) {
    if (!identifier || !password) {
        throw new Error("Username/email and password are required");
    }

    const admin = await Admin.findOne({
        $or: [{ username: identifier.toLowerCase().trim() }, { email: identifier.toLowerCase().trim() }],
    });

    // Same generic error whether the account doesn't exist or the password is
    // wrong — avoids leaking which usernames/emails are valid.
    if (!admin) {
        throw new Error("Invalid username/email or password");
    }

    const isMatch = await comparePassword(password, admin.passwordHash);
    if (!isMatch) {
        throw new Error("Invalid username/email or password");
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken(admin);
    return {
        token,
        admin: {
            id: admin._id.toString(),
            username: admin.username,
            email: admin.email,
            role: admin.role,
            lastLoginAt: admin.lastLoginAt,
        },
    };
}

/**
 * Ensures exactly one admin account exists. Runs once at server startup.
 * Reads ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env for the
 * very first account only — if any admin already exists in the DB this is
 * a no-op, so editing .env later has no effect (manage credentials via DB
 * from then on).
 */
export async function ensureAdminSeed() {
    const existingCount = await Admin.countDocuments();
    if (existingCount > 0) {
        return;
    }

    const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase().trim();
    const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
    let password = process.env.ADMIN_PASSWORD;

    let generated = false;
    if (!password) {
        password = crypto.randomBytes(9).toString("base64url"); // 12-char random secret
        generated = true;
    }

    const passwordHash = await hashPassword(password);
    await Admin.create({ username, email, passwordHash });

    logger.success("No admin account found — seeded a new one:");
    logger.info(`  Username: ${username}`);
    logger.info(`  Email:    ${email}`);
    if (generated) {
        logger.warn(
            `  Password: ${password}  <-- generated automatically because ADMIN_PASSWORD was not set in .env. ` +
            `Save this now, it will not be shown again. Log in and consider rotating it.`
        );
    } else {
        logger.info(`  Password: (the value you set in ADMIN_PASSWORD)`);
    }
}
