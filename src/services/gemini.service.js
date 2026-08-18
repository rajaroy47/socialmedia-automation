// src/services/gemini.service.js

import genAI, { GEMINI_MODEL } from "../config/gemini.config.js";
import { logger } from "../utils/logger.js";


// ============================================================
// JSON EXTRACTOR
// ============================================================

function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
        throw new Error("Failed to parse JSON from Gemini response");
    }

    return JSON.parse(match[0]);
}


// ============================================================
// CONSTANTS
// ============================================================

const MIN_DURATION = 30;
const MAX_DURATION = 45;

const CHARS_PER_SECOND = 15;

const MIN_CHARS = MIN_DURATION * CHARS_PER_SECOND;
const MAX_CHARS = MAX_DURATION * CHARS_PER_SECOND;


// ============================================================
// GENERATE SCRIPT + SCENES
// ============================================================

export async function generateScriptAndScenes(topic) {

    logger.info(`Generating script for topic: "${topic}"`);


    // ========================================================
    // MAIN PROMPT
    // ========================================================

    const prompt = `
You are a professional short-form video script writer specializing in
natural Indian Hindi/Hinglish voiceovers.

Create a complete short-form video script based on this topic:

"${topic}"


============================================================
VOICEOVER IS FOR DIRECT TTS
============================================================

The voiceover text will be sent directly to a Text-to-Speech system.

Therefore, write it exactly like a REAL INDIAN PERSON would SPEAK.

It must NOT sound like:
- a textbook
- a news article
- a formal essay
- Sanskritized Hindi
- robotic AI narration
- machine-translated Hindi


It SHOULD sound like:
- a natural YouTube Shorts creator
- an Indian person casually explaining something
- conversational Hindi/Hinglish
- easy to listen to
- expressive and engaging
- smooth when spoken aloud


============================================================
NATURAL HINDI / HINGLISH
============================================================

Use natural everyday Hindi mixed with commonly spoken English.

DO NOT unnecessarily translate common English words into formal Hindi.

For example:

GOOD:
"Ye fact actually kaafi interesting hai."

GOOD:
"Agar aapko aise videos pasand hain, toh channel ko follow karna mat bhoolna."

GOOD:
"Iska reason sunke shayad aap bhi surprise ho jaoge."

BAD:
"यदि आपको ऐसे चलचित्र पसंद हैं तो हमारे माध्यम को अनुसरण करना न भूलें।"

BAD:
"इसका कारण अत्यंत आश्चर्यजनक है।"


Use natural spoken words such as:

"actually"
"basically"
"interesting"
"simple"
"important"
"fact"
"story"
"video"
"channel"
"follow"
"subscribe"
"comment"
"share"

when they naturally fit the sentence.


============================================================
SPEAKING STYLE
============================================================

Write for SPEECH, not for reading.

Use short and natural sentences.

Use punctuation to create natural pauses:

","
"."
"?"
"! "
"..."

But do not overuse punctuation.

The voiceover should flow naturally from one sentence to the next.


============================================================
CRITICAL: COMPLETE SENTENCES
============================================================

EVERY SENTENCE MUST BE COMPLETE.

NEVER end a sentence in the middle of an idea.

For example, NEVER write:

"Agar aapko aise videos pasand hain, toh hamare channel ke sath..."

This is INCOMPLETE.

Instead write:

"Agar aapko aise videos pasand hain, toh hamare channel ke sath jude rahiye."

or:

"Agar aapko aise interesting videos pasand hain, toh channel ko follow karna mat bhoolna."


NEVER produce incomplete endings such as:

"kyunki..."
"aur phir..."
"jiske baad..."
"toh aap..."
"agar aap..."
"iske liye..."
"aur sabse interesting baat..."
"hamare channel ke sath..."
"more videos ke liye..."


unless the sentence continues and is fully completed.


============================================================
SCENE REQUIREMENTS
============================================================

Generate EXACTLY 5 scenes.

Each scene must contain:

- sceneNumber
- imagePrompt
- voiceover


Each scene voiceover should normally contain
2-4 complete sentences.


============================================================
STORY STRUCTURE
============================================================

Use this natural structure:

Scene 1:
HOOK

Start with an interesting question, surprising fact,
or curiosity-building statement.

Scene 2:
CONTEXT

Explain what is happening and give the viewer enough context.

Scene 3:
MAIN INFORMATION

Reveal the most interesting or important information.

Scene 4:
SURPRISE / KEY POINT

Give the strongest or most surprising part.

Scene 5:
CONCLUSION

End the story properly.

If appropriate, finish with a natural CTA.

The final scene MUST NEVER feel cut off.


============================================================
DURATION
============================================================

Total voiceover duration MUST be between 30 and 45 seconds.

Target approximately:

${MIN_CHARS}-${MAX_CHARS} characters total.

Approximately 15 characters per second.

Do NOT sacrifice sentence completeness just to hit the character count.

A complete natural sentence is MORE IMPORTANT than exact character count.


============================================================
IMAGE PROMPTS
============================================================

Every imagePrompt must:

- be completely in English
- be detailed
- be cinematic
- describe the actual scene
- be visually interesting
- maintain visual continuity
- work well for AI image generation
- include:

"vertical 9:16 aspect ratio"

Do NOT put unnecessary text inside the image.


============================================================
FINAL VOICEOVER CHECK
============================================================

Before returning the JSON, mentally read the entire voiceover aloud.

Check:

1. Does every sentence end properly?
2. Does every scene end naturally?
3. Does the final scene have a proper conclusion?
4. Is there any sentence ending with "..." because the thought is unfinished?
5. Does it sound like a real Indian person?
6. Is the Hindi natural rather than overly formal?
7. Are English words used naturally?
8. Would this sound good when spoken by TTS?
9. Is the narration between 30-45 seconds?
10. Is there any abrupt or incomplete ending?

If anything is incomplete, REWRITE it before returning the JSON.


============================================================
OUTPUT
============================================================

Return ONLY valid JSON.

No markdown.
No code fences.
No explanation.

Format:

{
    "title": "Natural Hindi/Hinglish video title",
    "scenes": [
        {
            "sceneNumber": 1,
            "imagePrompt": "Detailed English cinematic image prompt, vertical 9:16 aspect ratio",
            "voiceover": "Complete natural Hindi/Hinglish spoken narration."
        },
        {
            "sceneNumber": 2,
            "imagePrompt": "Detailed English cinematic image prompt, vertical 9:16 aspect ratio",
            "voiceover": "Complete natural Hindi/Hinglish spoken narration."
        },
        {
            "sceneNumber": 3,
            "imagePrompt": "Detailed English cinematic image prompt, vertical 9:16 aspect ratio",
            "voiceover": "Complete natural Hindi/Hinglish spoken narration."
        },
        {
            "sceneNumber": 4,
            "imagePrompt": "Detailed English cinematic image prompt, vertical 9:16 aspect ratio",
            "voiceover": "Complete natural Hindi/Hinglish spoken narration."
        },
        {
            "sceneNumber": 5,
            "imagePrompt": "Detailed English cinematic image prompt, vertical 9:16 aspect ratio",
            "voiceover": "Complete natural Hindi/Hinglish spoken narration with a proper ending."
        }
    ]
}
`;


    // ========================================================
    // GENERATE
    // ========================================================

    const response = await genAI.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
    });


    let script = extractJson(response.text);


    // ========================================================
    // VALIDATE SCENES
    // ========================================================

    if (
        !script.scenes ||
        script.scenes.length < 4 ||
        script.scenes.length > 5
    ) {
        throw new Error(
            `Invalid scene count: ${script.scenes?.length || 0}. Must be 4-5.`
        );
    }


    // ========================================================
    // GET TOTAL VOICEOVER
    // ========================================================

    let totalText = script.scenes
        .map((scene) => scene.voiceover || "")
        .join(" ")
        .trim();


    let totalChars = totalText.length;

    let estimatedDuration =
        totalChars / CHARS_PER_SECOND;


    logger.info(
        `Initial script: ${totalChars} chars (~${estimatedDuration.toFixed(1)}s)`
    );


    // ========================================================
    // REWRITE IF TOO LONG
    // ========================================================

    if (totalChars > MAX_CHARS) {

        logger.warn(
            `Script too long (${totalChars} chars). Asking Gemini to rewrite naturally...`
        );


        const compressionPrompt = `
Rewrite the following Hindi/Hinglish short-video voiceover
so that it fits approximately ${MIN_CHARS}-${MAX_CHARS} characters.

IMPORTANT:

- Keep the same meaning.
- Keep the important facts.
- Do NOT remove the conclusion.
- Do NOT remove the final CTA if present.
- Do NOT cut sentences.
- Do NOT end with "...".
- Do NOT end with an unfinished phrase.
- Every sentence must be grammatically complete.
- Every scene must end naturally.
- Keep exactly ${script.scenes.length} scenes.
- Make it sound like a real Indian person speaking naturally.
- Use conversational Hindi/Hinglish.
- Keep common English words where natural.
- This text goes directly to TTS.
- Do not make it formal or robotic.

Return ONLY valid JSON.

Current script:

${JSON.stringify(script)}
`;


        const rewriteResponse =
            await genAI.models.generateContent({
                model: GEMINI_MODEL,
                contents: compressionPrompt,
            });


        script = extractJson(
            rewriteResponse.text
        );


        totalText = script.scenes
            .map((scene) => scene.voiceover || "")
            .join(" ")
            .trim();


        totalChars = totalText.length;

        estimatedDuration =
            totalChars / CHARS_PER_SECOND;


        logger.info(
            `Rewritten script: ${totalChars} chars (~${estimatedDuration.toFixed(1)}s)`
        );
    }


    // ========================================================
    // REWRITE IF TOO SHORT
    // ========================================================

    if (totalChars < MIN_CHARS) {

        logger.warn(
            `Script too short (${totalChars} chars). Asking Gemini to expand naturally...`
        );


        const expansionPrompt = `
Expand the following Hindi/Hinglish short-video voiceover
so that the total length becomes approximately ${MIN_CHARS}-${MAX_CHARS} characters.

IMPORTANT:

- Keep the original meaning.
- Do NOT add fake facts.
- Add natural explanations where useful.
- Do NOT repeat the same sentence.
- Do NOT use filler just to increase length.
- Keep exactly ${script.scenes.length} scenes.
- Every sentence must be complete.
- The final scene must have a proper conclusion.
- Make it sound like a real Indian person talking.
- Use natural conversational Hindi/Hinglish.
- Keep common English words naturally.
- This will be sent directly to TTS.
- Avoid formal, textbook-style Hindi.

Return ONLY valid JSON.

Current script:

${JSON.stringify(script)}
`;


        const expansionResponse =
            await genAI.models.generateContent({
                model: GEMINI_MODEL,
                contents: expansionPrompt,
            });


        script = extractJson(
            expansionResponse.text
        );


        totalText = script.scenes
            .map((scene) => scene.voiceover || "")
            .join(" ")
            .trim();


        totalChars = totalText.length;

        estimatedDuration =
            totalChars / CHARS_PER_SECOND;


        logger.info(
            `Expanded script: ${totalChars} chars (~${estimatedDuration.toFixed(1)}s)`
        );
    }


    // ========================================================
    // FINAL SENTENCE / VOICEOVER VALIDATION
    // ========================================================

    for (const scene of script.scenes) {

        if (
            !scene.voiceover ||
            !scene.voiceover.trim()
        ) {
            throw new Error(
                `Scene ${scene.sceneNumber} has empty voiceover`
            );
        }


        const voiceover =
            scene.voiceover.trim();


        // Detect obvious incomplete endings
        const incompleteEndingPattern =
            /(\.\.\.|,\s*$|:\s*$|\b(aur|toh|kyunki|agar|lekin|jiske|iske|hamare|aap|phir|ki|ke|se|par)\s*[.!?]?\s*$)/i;


        if (
            incompleteEndingPattern.test(
                voiceover
            )
        ) {
            throw new Error(
                `Scene ${scene.sceneNumber} voiceover appears incomplete: "${voiceover}"`
            );
        }


        // Sentence should normally end with punctuation
        if (
            !/[.!?।]$/.test(
                voiceover
            )
        ) {
            throw new Error(
                `Scene ${scene.sceneNumber} voiceover does not end with proper punctuation`
            );
        }
    }


    // ========================================================
    // FINAL LENGTH CHECK
    // ========================================================

    totalText = script.scenes
        .map((scene) => scene.voiceover)
        .join(" ")
        .trim();


    totalChars = totalText.length;

    estimatedDuration =
        totalChars / CHARS_PER_SECOND;


    if (estimatedDuration > MAX_DURATION) {

        logger.warn(
            `Final script is still slightly long: ${estimatedDuration.toFixed(1)}s`
        );

        // IMPORTANT:
        // DO NOT truncate the text.
        // A complete sentence is more important than
        // blindly cutting characters.
    }


    logger.success(
        `Script ready: ${script.scenes.length} scenes, ${totalChars} chars, ~${estimatedDuration.toFixed(1)}s`
    );


    return script;
}


// ============================================================
// GENERATE POST METADATA
// ============================================================

export async function generatePostMetadata({
    topic,
    title,
    scriptText
}) {

    const prompt = `
You are a social media growth strategist.

Based on this short video's topic and script,
write professional posting metadata.

Topic:
"${topic}"

Working title:
"${title}"

Script:
"${scriptText}"

Return ONLY valid JSON.

{
    "youtubeTitle": "Catchy, under 100 characters, includes a relevant keyword",
    "description": "3-5 sentences, professional tone, includes a natural call to action (like/subscribe/follow), written in English",
    "tags": ["8 to 15 relevant lowercase keyword tags, no # symbol"],
    "hashtags": ["5 to 8 Instagram-style hashtags, each starting with #"]
}
`;


    try {

        const response =
            await genAI.models.generateContent({
                model: GEMINI_MODEL,
                contents: prompt,
            });


        const metadata =
            extractJson(response.text);


        return {

            youtubeTitle:
                metadata.youtubeTitle ||
                title,

            description:
                metadata.description ||
                `${title}\n\nAuto-generated short on: ${topic}`,

            tags:
                Array.isArray(metadata.tags)
                    ? metadata.tags.slice(0, 15)
                    : [topic],

            hashtags:
                Array.isArray(metadata.hashtags)
                    ? metadata.hashtags.slice(0, 8)
                    : [],

        };

    } catch (error) {

        logger.warn(
            "Metadata generation failed, using fallback:",
            error.message
        );


        return {

            youtubeTitle:
                title,

            description:
                `${title}\n\nAuto-generated short on: ${topic}\n\nLike, share and follow for more!`,

            tags:
                [topic],

            hashtags:
                [],

        };
    }
}



// src/services/gemini.service.js

// import genAI, { GEMINI_MODEL } from "../config/gemini.config.js";
// import { logger } from "../utils/logger.js";

// /**
//  * Extract JSON object from Gemini response.
//  */
// function extractJson(text) {
//     if (!text) {
//         throw new Error("Empty response received from Gemini");
//     }

//     const cleanedText = text
//         .replace(/```json/gi, "")
//         .replace(/```/g, "")
//         .trim();

//     const match = cleanedText.match(/\{[\s\S]*\}/);

//     if (!match) {
//         throw new Error("Failed to parse JSON from Gemini response");
//     }

//     try {
//         return JSON.parse(match[0]);
//     } catch (error) {
//         logger.error("Invalid JSON returned by Gemini:", error.message);
//         throw new Error("Gemini returned invalid JSON");
//     }
// }

// /**
//  * Validate generated scenes.
//  */
// function validateScenes(script) {
//     if (!script || typeof script !== "object") {
//         throw new Error("Invalid script object returned by Gemini");
//     }

//     if (!script.title || typeof script.title !== "string") {
//         throw new Error("Generated script is missing a valid title");
//     }

//     if (!Array.isArray(script.scenes)) {
//         throw new Error("Generated script is missing scenes array");
//     }

//     if (script.scenes.length !== 5) {
//         throw new Error(
//             `Invalid scene count: ${script.scenes.length}. Must be exactly 5.`
//         );
//     }

//     script.scenes.forEach((scene, index) => {
//         const expectedSceneNumber = index + 1;

//         if (scene.sceneNumber !== expectedSceneNumber) {
//             throw new Error(
//                 `Invalid scene number at index ${index}. Expected ${expectedSceneNumber}.`
//             );
//         }

//         if (
//             !scene.imagePrompt ||
//             typeof scene.imagePrompt !== "string"
//         ) {
//             throw new Error(
//                 `Scene ${expectedSceneNumber} is missing imagePrompt`
//             );
//         }

//         if (
//             !scene.voiceover ||
//             typeof scene.voiceover !== "string"
//         ) {
//             throw new Error(
//                 `Scene ${expectedSceneNumber} is missing voiceover`
//             );
//         }

//         if (
//             !scene.imagePrompt
//                 .toLowerCase()
//                 .includes("vertical 9:16 aspect ratio")
//         ) {
//             throw new Error(
//                 `Scene ${expectedSceneNumber} imagePrompt must contain "vertical 9:16 aspect ratio"`
//             );
//         }
//     });

//     return true;
// }

// /**
//  * Calculate total voiceover characters.
//  */
// function getVoiceoverText(script) {
//     return script.scenes
//         .map((scene) => scene.voiceover.trim())
//         .join(" ")
//         .trim();
// }

// /**
//  * Generate a ClientFilingIndia-friendly short-form reel.
//  *
//  * Target:
//  * 30-45 seconds
//  * Ideal: 34-40 seconds
//  * Target characters: 510-600
//  *
//  * Exactly 5 scenes.
//  */
// export async function generateScriptAndScenes(topic) {
//     const MIN_DURATION = 30;
//     const MAX_DURATION = 45;

//     const CHARS_PER_SECOND = 15;

//     // We intentionally target a smaller range than the hard maximum.
//     // This gives us some safety against speech-rate differences.
//     const TARGET_MIN_CHARS = 510;
//     const TARGET_MAX_CHARS = 600;

//     const HARD_MIN_CHARS =
//         MIN_DURATION * CHARS_PER_SECOND; // 450

//     const HARD_MAX_CHARS =
//         MAX_DURATION * CHARS_PER_SECOND; // 675

//     logger.info(
//         `Generating ClientFilingIndia reel for topic: "${topic}"`
//     );

//     const prompt = `
// You are an expert short-form video scriptwriter and social media content
// creator.

// Create a HIGH-RETENTION Instagram Reel / YouTube Short based on:

// "${topic}"

// The content is being published by ClientFilingIndia.

// ClientFilingIndia is an Indian professional services brand covering areas
// such as business registration, GST, taxation, ITR, TDS, FSSAI, compliance,
// accounting, documentation and other business-related services.

// IMPORTANT:

// The topic may be a business/compliance topic OR a general educational topic
// such as history, science, facts, technology, interesting places, culture,
// etc.

// DO NOT force a business/compliance explanation if the topic is unrelated.

// If the topic is general educational content, make the reel primarily
// EDUCATIONAL and entertaining, with only a subtle brand presence at the end.

// ==================================================
// MAIN GOAL
// ==================================================

// Create a reel that feels:

// - Human
// - Natural
// - Interesting
// - Professional
// - Educational
// - Easy to understand
// - High-retention
// - Suitable for Indian audiences

// It must NOT sound like a textbook.

// It must NOT sound like an advertisement.

// It must NOT sound like AI-generated robotic narration.

// ==================================================
// EXACT REEL STRUCTURE
// ==================================================

// Generate EXACTLY 5 scenes.

// SCENE 1:
// HOOK + CURIOSITY

// SCENE 2:
// CONTEXT / PROBLEM / BACKGROUND

// SCENE 3:
// MAIN INFORMATION

// SCENE 4:
// INTERESTING FACT / KEY TAKEAWAY / EXPLANATION

// SCENE 5:
// CONCLUSION + NATURAL CTA

// The scenes must flow naturally as one continuous story.

// ==================================================
// VERY IMPORTANT DURATION RULE
// ==================================================

// The COMPLETE voiceover across all 5 scenes MUST be SHORT.

// TARGET:

// 510-600 characters TOTAL.

// ABSOLUTE LIMIT:

// 450-675 characters TOTAL.

// DO NOT exceed 675 characters.

// IDEAL TARGET:

// Approximately 550 characters.

// This is extremely important.

// The total character count means:

// scene 1 voiceover
// +
// scene 2 voiceover
// +
// scene 3 voiceover
// +
// scene 4 voiceover
// +
// scene 5 voiceover

// combined.

// DO NOT write 2-4 long sentences per scene.

// Each scene should generally contain:

// 1-2 short natural sentences.

// The entire script must fit comfortably into approximately 35-40 seconds.

// BE CONCISE.

// DO NOT explain unnecessary details.

// ONE REEL = ONE MAIN IDEA.

// ==================================================
// SCENE CHARACTER TARGETS
// ==================================================

// Aim approximately for:

// Scene 1: 80-110 characters
// Scene 2: 90-120 characters
// Scene 3: 100-130 characters
// Scene 4: 100-130 characters
// Scene 5: 70-100 characters

// Total:

// Approximately 510-600 characters.

// These are targets, not exact requirements.

// ==================================================
// HOOK
// ==================================================

// Scene 1 MUST immediately grab attention.

// Start directly with the interesting part.

// Do NOT start with:

// "Hello everyone..."

// "Namaste dosto..."

// "Aaj hum baat karenge..."

// "Welcome back..."

// Instead use curiosity.

// Examples:

// "Ye dekhne mein sirf ek wall lagti hai, lekin iska history kaafi shocking hai."

// "China ki Great Wall actually ek hi wall nahi hai!"

// "Ek aisi wall jo hazaaron saal purani hai... lekin ise banaya kyun gaya tha?"

// Create a unique hook based on the actual topic.

// Do not copy examples.

// ==================================================
// VOICEOVER LANGUAGE
// ==================================================

// Use natural Indian Hindi/Hinglish.

// The narration should sound like a real person talking.

// Use commonly spoken English words naturally.

// Examples:

// "history"

// "business"

// "tax"

// "GST"

// "company"

// "documents"

// "technology"

// "science"

// "reason"

// "important"

// "actually"

// "basically"

// Do NOT unnecessarily translate common English words into highly formal Hindi.

// BAD:

// "Is prachin sanrachna ka aitihasik mahatva..."

// GOOD:

// "Is wall ki history actually kaafi interesting hai."

// BAD:

// "Vastutah iska nirmaan..."

// GOOD:

// "Basically, ise banane ka main reason protection tha."

// ==================================================
// SPEAKING STYLE
// ==================================================

// Write exactly how a person would SPEAK.

// Use:

// - Short sentences
// - Natural pauses
// - Conversational wording
// - Simple vocabulary
// - Occasional English words
// - Natural transitions

// Avoid:

// - Long sentences
// - Academic language
// - Excessive details
// - Sanskritized Hindi
// - Repetitive phrases
// - Robotic narration

// ==================================================
// CONTENT ACCURACY
// ==================================================

// Never invent facts.

// Never invent:

// - Statistics
// - Dates
// - Government rules
// - Tax rates
// - Penalties
// - Historical claims
// - Scientific claims
// - Famous quotes
// - Government announcements

// If you are not certain about an exact number or date, avoid the number.

// For historical/scientific topics, focus on broadly established information.

// ==================================================
// CLIENTFILINGINDIA BRANDING
// ==================================================

// If the topic is related to:

// - GST
// - Tax
// - ITR
// - TDS
// - Company registration
// - LLP
// - FSSAI
// - Compliance
// - Accounting
// - Business
// - Legal/business documentation

// Then Scene 5 should naturally mention ClientFilingIndia.

// Example:

// "Aise business compliance topics mein help chahiye? ClientFilingIndia se
// connect kar sakte hain."

// If the topic is NOT related to ClientFilingIndia's services, DO NOT force a
// business CTA into the educational content.

// For general topics, use a very subtle ending such as:

// "Aise interesting explainers ke liye ClientFilingIndia ko follow karein."

// Do not turn a history/science/facts reel into a tax advertisement.

// ==================================================
// IMAGE PROMPTS
// ==================================================

// Every imagePrompt MUST:

// - Be completely in English
// - Be cinematic
// - Be realistic
// - Be detailed
// - Be visually interesting
// - Match the exact voiceover
// - Be suitable for Instagram Reels
// - Be suitable for YouTube Shorts
// - Include:

// "vertical 9:16 aspect ratio"

// For historical topics:

// Use historically appropriate environments, architecture, clothing,
// landscapes and atmosphere.

// For business topics:

// Use realistic Indian professionals, offices, documents, laptops and
// business environments.

// For science topics:

// Use realistic scientific visualization.

// For facts/general topics:

// Create visually exciting realistic scenes related to the subject.

// Avoid:

// - Cartoon
// - Anime
// - Distorted faces
// - Bad hands
// - Extra fingers
// - Random logos
// - Watermarks
// - Fake government seals
// - Huge text inside images
// - Unrelated objects

// ==================================================
// VISUAL STORYTELLING
// ==================================================

// Scene 1:
// Strong visual hook.

// Scene 2:
// Show context/background.

// Scene 3:
// Show the main concept.

// Scene 4:
// Show the interesting detail or key takeaway.

// Scene 5:
// Show a clean memorable conclusion.

// Every image should look like it belongs to the same professional reel.

// ==================================================
// TITLE
// ==================================================

// Create a short Hindi/Hinglish title.

// The title should be:

// - Catchy
// - Natural
// - Curiosity-driven
// - Short
// - Relevant
// - Not clickbait

// ==================================================
// FINAL OUTPUT
// ==================================================

// Return ONLY valid JSON.

// NO markdown.

// NO code fences.

// NO explanation.

// NO comments.

// {
//   "title": "Natural Hindi/Hinglish title",
//   "scenes": [
//     {
//       "sceneNumber": 1,
//       "imagePrompt": "Detailed cinematic English image prompt, vertical 9:16 aspect ratio",
//       "voiceover": "Short natural Hindi/Hinglish narration"
//     },
//     {
//       "sceneNumber": 2,
//       "imagePrompt": "Detailed cinematic English image prompt, vertical 9:16 aspect ratio",
//       "voiceover": "Short natural Hindi/Hinglish narration"
//     },
//     {
//       "sceneNumber": 3,
//       "imagePrompt": "Detailed cinematic English image prompt, vertical 9:16 aspect ratio",
//       "voiceover": "Short natural Hindi/Hinglish narration"
//     },
//     {
//       "sceneNumber": 4,
//       "imagePrompt": "Detailed cinematic English image prompt, vertical 9:16 aspect ratio",
//       "voiceover": "Short natural Hindi/Hinglish narration"
//     },
//     {
//       "sceneNumber": 5,
//       "imagePrompt": "Detailed cinematic English image prompt, vertical 9:16 aspect ratio",
//       "voiceover": "Short natural Hindi/Hinglish narration"
//     }
//   ]
// }

// FINAL CHECK BEFORE RETURNING:

// 1. Exactly 5 scenes.
// 2. Total voiceover 510-600 characters ideally.
// 3. NEVER exceed 675 characters.
// 4. Never return more than 1-2 short sentences per scene.
// 5. Strong hook.
// 6. Natural Hindi/Hinglish.
// 7. No formal textbook Hindi.
// 8. No fake facts.
// 9. Every image prompt is English.
// 10. Every image prompt contains "vertical 9:16 aspect ratio".
// 11. Scene 5 has a natural ending.
// 12. Do not force ClientFilingIndia into unrelated topics.
// `;

//     const response = await genAI.models.generateContent({
//         model: GEMINI_MODEL,
//         contents: prompt,
//     });

//     let script = extractJson(response.text);

//     validateScenes(script);

//     let totalText = getVoiceoverText(script);
//     let totalCharacters = totalText.length;
//     let estimatedDuration =
//         totalCharacters / CHARS_PER_SECOND;

//     logger.info(
//         `Generated voiceover: ${totalCharacters} chars, approximately ${estimatedDuration.toFixed(
//             1
//         )} seconds`
//     );

//     // ============================================================
//     // AUTOMATIC REPAIR
//     // ============================================================
//     //
//     // Gemini can occasionally ignore the character instruction.
//     // Instead of killing the entire pipeline, ask Gemini to rewrite it.
//     //

//     if (
//         totalCharacters < HARD_MIN_CHARS ||
//         totalCharacters > HARD_MAX_CHARS
//     ) {
//         logger.warn(
//             `Voiceover outside duration range (${totalCharacters} chars). Attempting automatic repair...`
//         );

//         script = await repairScriptLength(
//             topic,
//             script,
//             TARGET_MIN_CHARS,
//             TARGET_MAX_CHARS
//         );

//         validateScenes(script);

//         totalText = getVoiceoverText(script);
//         totalCharacters = totalText.length;
//         estimatedDuration =
//             totalCharacters / CHARS_PER_SECOND;

//         logger.info(
//             `After repair: ${totalCharacters} chars, approximately ${estimatedDuration.toFixed(
//                 1
//             )} seconds`
//         );
//     }

//     // ============================================================
//     // FINAL SAFETY CHECK
//     // ============================================================

//     if (totalCharacters < HARD_MIN_CHARS) {
//         throw new Error(
//             `Generated script too short: ${totalCharacters} characters (~${estimatedDuration.toFixed(
//                 1
//             )}s).`
//         );
//     }

//     if (totalCharacters > HARD_MAX_CHARS) {
//         throw new Error(
//             `Generated script too long after repair: ${totalCharacters} characters (~${estimatedDuration.toFixed(
//                 1
//             )}s).`
//         );
//     }

//     logger.success(
//         `ClientFilingIndia reel ready: ${script.scenes.length} scenes, ~${estimatedDuration.toFixed(
//             1
//         )}s`
//     );

//     return script;
// }

// /**
//  * Automatically repairs an overlong or underlength script.
//  *
//  * IMPORTANT:
//  * We ask Gemini to rewrite the complete narration instead of cutting
//  * individual words. This prevents broken sentences and unnatural endings.
//  */
// async function repairScriptLength(
//     topic,
//     script,
//     targetMinChars,
//     targetMaxChars
// ) {
//     const currentText = getVoiceoverText(script);

//     const repairPrompt = `
// You are editing a short-form video script.

// Topic:
// "${topic}"

// Current script:

// ${JSON.stringify(script, null, 2)}

// The current voiceover is approximately ${currentText.length} characters.

// Rewrite ONLY the voiceover content so that the TOTAL voiceover across all
// 5 scenes is between ${targetMinChars} and ${targetMaxChars} characters.

// TARGET:
// Approximately 550 characters.

// VERY IMPORTANT:

// - Keep exactly 5 scenes.
// - Keep the same scene structure.
// - Keep the same topic.
// - Preserve the main facts.
// - Preserve the hook.
// - Preserve the natural flow.
// - Preserve the ending.
// - Preserve the ClientFilingIndia CTA when relevant.
// - Do NOT remove important information just to shorten it.
// - Remove unnecessary explanations and filler.
// - Use short spoken sentences.
// - Use natural Hindi/Hinglish.
// - Do NOT use formal Hindi.
// - Do NOT add new facts.
// - Do NOT invent statistics.
// - Do NOT change imagePrompt.
// - Do NOT change sceneNumber.
// - Only rewrite the voiceover text.

// STRICT CHARACTER LIMIT:

// Minimum: ${targetMinChars}
// Maximum: ${targetMaxChars}

// DO NOT exceed ${targetMaxChars} characters.

// The COMPLETE combined voiceover must fit within the limit.

// Return ONLY valid JSON.

// {
//   "title": "same or improved title",
//   "scenes": [
//     {
//       "sceneNumber": 1,
//       "imagePrompt": "same image prompt",
//       "voiceover": "short rewritten voiceover"
//     },
//     {
//       "sceneNumber": 2,
//       "imagePrompt": "same image prompt",
//       "voiceover": "short rewritten voiceover"
//     },
//     {
//       "sceneNumber": 3,
//       "imagePrompt": "same image prompt",
//       "voiceover": "short rewritten voiceover"
//     },
//     {
//       "sceneNumber": 4,
//       "imagePrompt": "same image prompt",
//       "voiceover": "short rewritten voiceover"
//     },
//     {
//       "sceneNumber": 5,
//       "imagePrompt": "same image prompt",
//       "voiceover": "short rewritten voiceover"
//     }
//   ]
// }
// `;

//     const response = await genAI.models.generateContent({
//         model: GEMINI_MODEL,
//         contents: repairPrompt,
//     });

//     const repairedScript = extractJson(response.text);

//     validateScenes(repairedScript);

//     const repairedText = getVoiceoverText(repairedScript);
//     const repairedCharacters = repairedText.length;

//     logger.info(
//         `Script repair result: ${repairedCharacters} characters`
//     );

//     // ============================================================
//     // SECOND REPAIR IF GEMINI STILL MISSES THE LIMIT
//     // ============================================================

//     if (
//         repairedCharacters < targetMinChars ||
//         repairedCharacters > targetMaxChars
//     ) {
//         logger.warn(
//             `First repair still outside target (${repairedCharacters} chars). Running final compression...`
//         );

//         const finalRepairPrompt = `
// Compress this short-form video voiceover.

// Topic:
// "${topic}"

// Current script:
// ${JSON.stringify(repairedScript, null, 2)}

// CURRENT TOTAL VOICEOVER:
// ${repairedCharacters} characters.

// Rewrite the voiceovers ONLY.

// STRICT FINAL REQUIREMENT:

// Total voiceover must be between 500 and 590 characters.

// Target approximately 550 characters.

// Rules:

// - Exactly 5 scenes.
// - Do not change sceneNumber.
// - Do not change imagePrompt.
// - Keep the main meaning.
// - Keep the strongest hook.
// - Keep the most important information.
// - Keep a natural ending.
// - Keep ClientFilingIndia CTA if relevant.
// - Remove filler.
// - Use very short natural Hindi/Hinglish sentences.
// - No formal Hindi.
// - No new facts.
// - No statistics.
// - No explanations outside JSON.

// Return ONLY valid JSON.

// {
//   "title": "same title",
//   "scenes": [
//     {
//       "sceneNumber": 1,
//       "imagePrompt": "same image prompt",
//       "voiceover": "compressed voiceover"
//     },
//     {
//       "sceneNumber": 2,
//       "imagePrompt": "same image prompt",
//       "voiceover": "compressed voiceover"
//     },
//     {
//       "sceneNumber": 3,
//       "imagePrompt": "same image prompt",
//       "voiceover": "compressed voiceover"
//     },
//     {
//       "sceneNumber": 4,
//       "imagePrompt": "same image prompt",
//       "voiceover": "compressed voiceover"
//     },
//     {
//       "sceneNumber": 5,
//       "imagePrompt": "same image prompt",
//       "voiceover": "compressed voiceover"
//     }
//   ]
// }
// `;

//         const finalResponse = await genAI.models.generateContent({
//             model: GEMINI_MODEL,
//             contents: finalRepairPrompt,
//         });

//         const finalScript = extractJson(finalResponse.text);

//         validateScenes(finalScript);

//         const finalText = getVoiceoverText(finalScript);
//         const finalCharacters = finalText.length;

//         logger.info(
//             `Final compression result: ${finalCharacters} characters`
//         );

//         if (
//             finalCharacters >= HARD_MIN_CHARS &&
//             finalCharacters <= HARD_MAX_CHARS
//         ) {
//             return finalScript;
//         }

//         throw new Error(
//             `Unable to generate a valid 30-45 second script after automatic repair. Final length: ${finalCharacters} characters.`
//         );
//     }

//     return repairedScript;
// }

// /**
//  * Generates platform-ready posting metadata for ClientFilingIndia.
//  */
// export async function generatePostMetadata({
//     topic,
//     title,
//     scriptText,
// }) {
//     const prompt = `
// You are a professional social media growth strategist for ClientFilingIndia.

// Create professional metadata for this short-form video.

// TOPIC:
// "${topic}"

// VIDEO TITLE:
// "${title}"

// SCRIPT:
// "${scriptText}"

// Platforms:

// - YouTube Shorts
// - Instagram Reels
// - Facebook Reels

// ==================================================
// YOUTUBE TITLE
// ==================================================

// Create one catchy title under 100 characters.

// Use Hindi/Hinglish when appropriate.

// Make it:

// - Curiosity-driven
// - Professional
// - Search-friendly
// - Natural
// - Not misleading

// ==================================================
// DESCRIPTION
// ==================================================

// Write 3-5 professional sentences in natural English.

// Mention what the video explains.

// Add a natural CTA.

// Do not make it sound like aggressive advertising.

// ==================================================
// TAGS
// ==================================================

// Generate 10-15 relevant SEO tags.

// Rules:

// - lowercase
// - no # symbol
// - no duplicates
// - topic-specific
// - India-focused when relevant

// ==================================================
// HASHTAGS
// ==================================================

// Generate 6-8 relevant hashtags.

// Every hashtag must begin with #.

// Use lowercase.

// Include:

// #clientfilingindia

// when relevant.

// ==================================================
// OUTPUT
// ==================================================

// Return ONLY valid JSON.

// {
//   "youtubeTitle": "Catchy YouTube Shorts title",
//   "description": "Professional description",
//   "tags": [
//     "keyword one",
//     "keyword two"
//   ],
//   "hashtags": [
//     "#hashtagone",
//     "#hashtagtwo"
//   ]
// }
// `;

//     try {
//         const response = await genAI.models.generateContent({
//             model: GEMINI_MODEL,
//             contents: prompt,
//         });

//         const metadata = extractJson(response.text);

//         return {
//             youtubeTitle:
//                 typeof metadata.youtubeTitle === "string" &&
//                 metadata.youtubeTitle.trim()
//                     ? metadata.youtubeTitle.trim()
//                     : title,

//             description:
//                 typeof metadata.description === "string" &&
//                 metadata.description.trim()
//                     ? metadata.description.trim()
//                     : `${title}\n\nLearn more with ClientFilingIndia.`,

//             tags: Array.isArray(metadata.tags)
//                 ? metadata.tags
//                       .filter(
//                           (tag) =>
//                               typeof tag === "string" &&
//                               tag.trim()
//                       )
//                       .map((tag) =>
//                           tag
//                               .trim()
//                               .toLowerCase()
//                               .replace(/^#/, "")
//                       )
//                       .filter(Boolean)
//                       .slice(0, 15)
//                 : [],

//             hashtags: Array.isArray(metadata.hashtags)
//                 ? metadata.hashtags
//                       .filter(
//                           (hashtag) =>
//                               typeof hashtag === "string" &&
//                               hashtag.trim()
//                       )
//                       .map((hashtag) => {
//                           const clean = hashtag
//                               .trim()
//                               .replace(/^#+/, "")
//                               .toLowerCase();

//                           return `#${clean}`;
//                       })
//                       .filter(
//                           (value, index, array) =>
//                               array.indexOf(value) === index
//                       )
//                       .slice(0, 8)
//                 : [],
//         };
//     } catch (error) {
//         logger.warn(
//             "Metadata generation failed, using fallback:",
//             error.message
//         );

//         return {
//             youtubeTitle: title,

//             description:
//                 `${title}\n\n` +
//                 `Learn useful information about business, finance, ` +
//                 `tax and compliance with ClientFilingIndia.\n\n` +
//                 `Follow ClientFilingIndia for more useful updates.`,

//             tags: [
//                 "clientfilingindia",
//                 "business",
//                 "business compliance",
//                 "tax india",
//                 "business services",
//             ],

//             hashtags: [
//                 "#clientfilingindia",
//                 "#businessindia",
//                 "#businesscompliance",
//                 "#taxindia",
//                 "#startupindia",
//             ],
//         };
//     }
// }
