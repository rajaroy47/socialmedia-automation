// src/services/gemini.service.js

import genAI, { GEMINI_MODEL } from "../config/gemini.config.js";
import { logger } from "../utils/logger.js";

function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse JSON from Gemini response");
    return JSON.parse(match[0]);
}

/**
 * Generates a 4-5 scene Hindi/Hinglish script (title + per-scene image
 * prompt + voiceover) sized to land between 30-45 seconds of narration.
 */
export async function generateScriptAndScenes(topic) {
    const MIN_DURATION = 30;
    const MAX_DURATION = 45;
    const MIN_CHARS = MIN_DURATION * 15;
    const MAX_CHARS = MAX_DURATION * 15;

    logger.info(`Generating script for topic: "${topic}"`);

    const prompt = `You are a professional short-form video script writer who writes natural, engaging Hindi/Hinglish narration for human-like AI voiceovers.

Create a complete video script with scenes based on this topic: "${topic}"

CRITICAL DURATION REQUIREMENTS:
- Total voiceover duration MUST be between 30-45 seconds
- Hindi speech rate: ~15 characters per second
- Therefore total characters should be between ${MIN_CHARS}-${MAX_CHARS} characters
- Each scene voiceover should be 2-4 sentences (not too short, not too long)
- Make the narration COMPLETE and NATURAL - no abrupt endings

IMPORTANT RULES:
1. Generate exactly 4-5 scenes (no more than 5, no less than 4).
2. Each scene MUST have: sceneNumber, imagePrompt, voiceover
3. IMAGE PROMPT: Write completely in English, detailed, cinematic, visually descriptive. Include "vertical 9:16 aspect ratio".
4. VOICEOVER LANGUAGE: Natural spoken Hindi/Hinglish, like a real Indian person explaining something. Not overly formal/Sanskritized.
5. Each scene should have 2-4 sentences of narration, flowing into a complete story.
6. Total character count (all voiceovers combined) should be between ${MIN_CHARS} and ${MAX_CHARS} characters.

OUTPUT FORMAT — return ONLY valid JSON, no markdown/code fences/explanations:
{
  "title": "Natural Hindi/Hinglish video title",
  "scenes": [
    { "sceneNumber": 1, "imagePrompt": "...", "voiceover": "..." }
  ]
}`;

    const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
    });

    const script = extractJson(response.text);

    if (!script.scenes || script.scenes.length < 4 || script.scenes.length > 5) {
        throw new Error(`Invalid scene count: ${script.scenes?.length || 0}. Must be 4-5.`);
    }

    let totalText = script.scenes.map((s) => s.voiceover).join(" ");
    let estimatedDuration = totalText.length / 15;

    if (estimatedDuration < MIN_DURATION && totalText.length < 400) {
        throw new Error(`Generated script too short (${estimatedDuration.toFixed(1)}s). Try again.`);
    }

    if (estimatedDuration > MAX_DURATION) {
        const targetChars = MAX_DURATION * 15;
        const ratio = targetChars / totalText.length;
        for (const scene of script.scenes) {
            const words = scene.voiceover.split(" ");
            const newLength = Math.max(8, Math.round(words.length * ratio));
            if (words.length > newLength) {
                scene.voiceover = words.slice(0, newLength).join(" ") + ".";
            }
        }
    }

    const finalText = script.scenes.map((s) => s.voiceover).join(" ");
    logger.success(
        `Script ready: ${script.scenes.length} scenes, ~${(finalText.length / 15).toFixed(1)}s`
    );

    return script;
}

/**
 * Turns a script into professional, platform-ready posting metadata:
 * an SEO-friendly title, a description with a soft CTA, and keyword tags.
 * Falls back to a safe default if Gemini's JSON parsing fails so the
 * pipeline never blocks on this step.
 */
export async function generatePostMetadata({ topic, title, scriptText }) {
    const prompt = `You are a social media growth strategist. Based on this short video's topic and script, write professional posting metadata.

Topic: "${topic}"
Working title: "${title}"
Script (Hindi/Hinglish): "${scriptText}"

Return ONLY valid JSON, no markdown/code fences:
{
  "youtubeTitle": "Catchy, under 100 characters, includes a relevant keyword",
  "description": "3-5 sentences, professional tone, includes a natural call to action (like/subscribe/follow), written in English",
  "tags": ["8 to 15 relevant lowercase keyword tags, no # symbol"],
  "hashtags": ["5 to 8 Instagram-style hashtags, each starting with #"]
}`;

    try {
        const response = await genAI.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
        });
        const metadata = extractJson(response.text);
        return {
            youtubeTitle: metadata.youtubeTitle || title,
            description: metadata.description || `${title}\n\nAuto-generated short on: ${topic}`,
            tags: Array.isArray(metadata.tags) ? metadata.tags.slice(0, 15) : [topic],
            hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags.slice(0, 8) : [],
        };
    } catch (error) {
        logger.warn("Metadata generation failed, using fallback:", error.message);
        return {
            youtubeTitle: title,
            description: `${title}\n\nAuto-generated short on: ${topic}\n\nLike, share and follow for more!`,
            tags: [topic],
            hashtags: [],
        };
    }
}
