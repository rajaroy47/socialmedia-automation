// src/services/elevenlabs.service.js
//
// Generates Hindi narration audio with ElevenLabs. Reads up to 10
// ELEVENLABS_API_KEY_1..10 keys from .env and rotates through them the same
// way huggingface.service.js does.
//
// IMPORTANT: each ElevenLabs API key belongs to its own account, and voice
// IDs are per-account too — a voice ID that exists under key #1 will not
// exist (or will resolve to a totally different voice) under key #2. So
// every key must have its own matching ELEVENLABS_VOICE_ID_<n> in .env, and
// whichever key ends up being used for a given request is what decides
// which voice ID gets sent to the API.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { runWithKeyRotation } from "../utils/keyRotator.js";
import { logger } from "../utils/logger.js";

const MAX_KEYS = 10;
const FALLBACK_VOICE_ID = "PCUiSZg5lgvhM8pusLk0";

// Kept for backwards-compat (in case anything else imports this), resolves
// to key #1's voice.
export const ELEVENLABS_VOICE_ID =
    process.env.ELEVENLABS_VOICE_ID_1 || process.env.ELEVENLABS_VOICE_ID || FALLBACK_VOICE_ID;

function getElevenLabsKeys() {
    const keys = [];
    for (let i = 1; i <= MAX_KEYS; i++) {
        const key = process.env[`ELEVENLABS_API_KEY_${i}`];
        // ELEVENLABS_VOICE_ID_1 is the "proper" name; ELEVENLABS_VOICE_ID
        // (no suffix) is still honored for key #1 only, for backwards
        // compatibility with older .env files.
        const voiceId =
            process.env[`ELEVENLABS_VOICE_ID_${i}`] ||
            (i === 1 ? process.env.ELEVENLABS_VOICE_ID : undefined) ||
            undefined;

        if (key && !voiceId) {
            logger.warn(
                `[ElevenLabs] ELEVENLABS_API_KEY_${i} is set but ELEVENLABS_VOICE_ID_${i} is missing in .env — ` +
                `falling back to the default voice (${FALLBACK_VOICE_ID}) for that key.`
            );
        }

        keys.push({ key, meta: { voiceId: voiceId || FALLBACK_VOICE_ID } });
    }
    return keys;
}

async function streamToBuffer(response) {
    if (Buffer.isBuffer(response)) return response;
    if (response?.data) return Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);

    const chunks = [];
    for await (const chunk of response) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * Generate narration audio for the given text, rotating through every
 * configured ElevenLabs key until one works. Each key automatically uses
 * its own matching voice ID (ELEVENLABS_VOICE_ID_<n>) unless you explicitly
 * pass `voiceIdOverride` to force a specific voice regardless of which key
 * ends up being used.
 */
export async function generateNarration(text, voiceIdOverride = null) {
    const buffer = await runWithKeyRotation({
        providerName: "ElevenLabs",
        keys: getElevenLabsKeys(),
        taskFn: async (apiKey, keyLabel, meta) => {
            const voiceId = voiceIdOverride || meta?.voiceId || FALLBACK_VOICE_ID;
            logger.info(`[ElevenLabs] Using voice ${voiceId} for ${keyLabel}`);
            const client = new ElevenLabsClient({ apiKey });
            const response = await client.textToSpeech.convert(voiceId, {
                text,
                modelId: "eleven_multilingual_v2",
                voiceSettings: {
                    stability: 0.5,
                    similarityBoost: 0.75,
                    style: 0.0,
                    useSpeakerBoost: true,
                },
            });
            return streamToBuffer(response);
        },
    });

    logger.success(`Narration generated (${buffer.length} bytes)`);
    return buffer;
}
