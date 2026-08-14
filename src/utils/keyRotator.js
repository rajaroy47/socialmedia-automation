// src/utils/keyRotator.js
//
// Generic "try key 1, if it's out of quota try key 2, then key 3 ... " helper.
// Used by the ElevenLabs and HuggingFace services so you can register up to
// 10 free-tier keys (one per email) for each provider and never think about
// quota limits again — the rotator walks the whole list recursively and only
// throws once *every* key has failed.
//
// It also remembers the last key that worked (per provider) so the next call
// starts there instead of always hammering key #1 first.

import { logger } from "./logger.js";

const lastGoodIndex = new Map(); // providerName -> index

/**
 * Heuristics for "this error means the key is out of quota / rate limited",
 * as opposed to a real, non-recoverable error (bad request, invalid prompt,
 * etc.) that would fail on every key anyway.
 */
function isQuotaOrRateLimitError(error) {
    const status =
        error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        error?.httpStatus;

    if ([401, 402, 403, 429].includes(Number(status))) return true;

    const message = (
        error?.message ||
        error?.response?.data?.message ||
        error?.body ||
        ""
    ).toString().toLowerCase();

    const quotaSignals = [
        "quota",
        "rate limit",
        "rate_limit",
        "too many requests",
        "credits",
        "insufficient",
        "exceeded",
        "limit reached",
        "unauthorized",
        "invalid api key",
        "invalid_api_key",
        "payment required",
    ];

    return quotaSignals.some((signal) => message.includes(signal));
}

/**
 * Runs `taskFn(key, keyLabel)` against a list of API keys, recursively
 * falling through to the next key whenever the current one looks like it
 * hit a quota / auth wall. Throws a combined error only if every key fails.
 *
 * @param {Object} opts
 * @param {string} opts.providerName - e.g. "ElevenLabs", "HuggingFace"
 * @param {string[]} opts.keys - ordered list of API keys (falsy entries skipped)
 * @param {(key: string, keyLabel: string) => Promise<any>} opts.taskFn
 * @param {number} [opts.startIndex] - override which key to try first
 */
export async function runWithKeyRotation({ providerName, keys, taskFn, startIndex }) {
    const validKeys = keys
        .map((key, idx) => ({ key, idx }))
        .filter((entry) => !!entry.key && entry.key.trim().length > 0);

    if (validKeys.length === 0) {
        throw new Error(
            `[${providerName}] No API keys configured. Add at least one *_API_KEY_1 in .env`
        );
    }

    const remembered = lastGoodIndex.get(providerName) ?? 0;
    const preferredStart = startIndex ?? remembered;

    // Rotate the list so we start at `preferredStart`, wrapping around.
    const rotated = [
        ...validKeys.filter((e) => e.idx >= preferredStart),
        ...validKeys.filter((e) => e.idx < preferredStart),
    ];

    const errors = [];

    async function attempt(position) {
        if (position >= rotated.length) {
            const summary = errors
                .map((e) => `  - key #${e.idx + 1}: ${e.message}`)
                .join("\n");
            throw new Error(
                `[${providerName}] All ${rotated.length} API key(s) failed / exhausted quota.\n${summary}`
            );
        }

        const { key, idx } = rotated[position];
        const keyLabel = `${providerName}_KEY_${idx + 1}`;

        try {
            logger.info(`[${providerName}] Trying ${keyLabel}...`);
            const result = await taskFn(key, keyLabel);
            lastGoodIndex.set(providerName, idx);
            logger.success(`[${providerName}] ${keyLabel} succeeded.`);
            return result;
        } catch (error) {
            const reason = error?.message || String(error);
            logger.warn(`[${providerName}] ${keyLabel} failed: ${reason}`);

            if (!isQuotaOrRateLimitError(error)) {
                // Not a quota/auth issue (e.g. bad prompt) — retrying with a
                // different key won't help, so fail fast instead of burning
                // through every remaining key for nothing.
                throw error;
            }

            errors.push({ idx, message: reason });
            // Recursive fallback to the next key.
            return attempt(position + 1);
        }
    }

    return attempt(0);
}