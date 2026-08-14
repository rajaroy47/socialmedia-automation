// src/services/elevenlabs.service.js
//
// Generates Hindi narration audio with ElevenLabs. Reads up to 10
// ELEVENLABS_API_KEY_1..10 keys from .env and rotates through them the same
// way huggingface.service.js does.

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { runWithKeyRotation } from "../utils/keyRotator.js";
import { logger } from "../utils/logger.js";

const MAX_KEYS = 10;
export const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "PCUiSZg5lgvhM8pusLk0";

function getElevenLabsKeys() {
    const keys = [];
    for (let i = 1; i <= MAX_KEYS; i++) {
        keys.push(process.env[`ELEVENLABS_API_KEY_${i}`]);
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
 * configured ElevenLabs key until one works.
 */
export async function generateNarration(text, voiceId = ELEVENLABS_VOICE_ID) {
    const buffer = await runWithKeyRotation({
        providerName: "ElevenLabs",
        keys: getElevenLabsKeys(),
        taskFn: async (apiKey) => {
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
