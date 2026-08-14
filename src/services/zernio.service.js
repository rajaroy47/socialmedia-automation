// src/services/zernio.service.js
//
// Thin wrapper around the Zernio SDK (with a raw-fetch fallback) so both the
// YouTube and Instagram controllers/jobs share one implementation.
//
// IMPORTANT: the Zernio SDK expects the payload wrapped as { body: {...} },
// not the raw object. Passing the raw object silently fails the SDK call,
// which then falls through to the direct-fetch fallback hitting the wrong
// shape / wrong endpoint and getting back an HTML error page instead of JSON
// (the "<!DOCTYPE ... is not valid JSON" error).

import zernio from "../config/zernio.config.js";
import { logger } from "../utils/logger.js";

async function directPostToZernio(body) {
    const apiKey = process.env.ZERNIO_API_KEY;
    const response = await fetch("https://zernio.com/api/posts", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Zernio API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
}

async function createPost(body) {
    try {
        const result = await zernio.posts.createPost({ body });
        logger.success("Post created via Zernio SDK");
        return result;
    } catch (sdkError) {
        logger.warn("Zernio SDK failed, falling back to direct API call:", sdkError.message);
        return directPostToZernio(body);
    }
}

/**
 * Builds the { publishNow: true } / { scheduledFor } tail shared by every
 * platform's post body.
 */
function schedulingFields(publishNow, scheduledFor) {
    return publishNow ? { publishNow: true } : { scheduledFor };
}

/**
 * Publishes a video to YouTube (Shorts by default, since content is 9:16).
 */
export async function postVideoToYoutube({
    title,
    description,
    videoUrl,
    thumbnail,
    tags = [],
    visibility = "public",
    categoryId = "22",
    language = "en",
    accountId = process.env.YOUTUBE_ACCOUNT_ID,
    publishNow = true,
    scheduledFor = null,
}) {
    if (!accountId) throw new Error("YOUTUBE_ACCOUNT_ID is not configured");

    const body = {
        content: description,
        mediaItems: [{ type: "video", url: videoUrl, thumbnail: thumbnail || "" }],
        platforms: [
            {
                platform: "youtube",
                accountId,
                platformSpecificData: {
                    title,
                    description,
                    visibility,
                    tags: Array.isArray(tags) ? tags : [tags],
                    categoryId,
                    language,
                    madeForKids: false,
                    notifySubscribers: true,
                },
            },
        ],
        ...schedulingFields(publishNow, scheduledFor),
    };

    return createPost(body);
}

/**
 * Publishes a video as an Instagram Reel (feed-visible, with caption/tags).
 */
export async function postReelToInstagram({
    caption,
    videoUrl,
    thumbnail,
    accountId = process.env.INSTAGRAM_ACCOUNT_ID,
    publishNow = true,
    scheduledFor = null,
}) {
    if (!accountId) throw new Error("INSTAGRAM_ACCOUNT_ID is not configured");

    const body = {
        content: caption,
        mediaItems: [{ type: "video", url: videoUrl, thumbnail: thumbnail || "" }],
        platforms: [
            {
                platform: "instagram",
                accountId,
                platformSpecificData: {
                    contentType: "reel",
                    caption,
                    shareToFeed: true,
                },
            },
        ],
        ...schedulingFields(publishNow, scheduledFor),
    };

    return createPost(body);
}

/**
 * Publishes an Instagram Story (24h, no caption/tags support on the API).
 */
export async function postStoryToInstagram({
    mediaUrl,
    accountId = process.env.INSTAGRAM_ACCOUNT_ID,
    publishNow = true,
    scheduledFor = null,
}) {
    if (!accountId) throw new Error("INSTAGRAM_ACCOUNT_ID is not configured");

    const body = {
        mediaItems: [{ type: "image", url: mediaUrl }],
        platforms: [
            {
                platform: "instagram",
                accountId,
                platformSpecificData: { contentType: "story" },
            },
        ],
        ...schedulingFields(publishNow, scheduledFor),
    };

    return createPost(body);
}

export async function listZernioAccounts() {
    return zernio.accounts.listAccounts();
}

