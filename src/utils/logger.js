// src/utils/logger.js
// Tiny console logger so every module logs consistently with a timestamp.

function ts() {
    return new Date().toISOString();
}

export const logger = {
    info: (...args) => console.log(`ℹ️  [${ts()}]`, ...args),
    success: (...args) => console.log(`✅ [${ts()}]`, ...args),
    warn: (...args) => console.warn(`⚠️  [${ts()}]`, ...args),
    error: (...args) => console.error(`❌ [${ts()}]`, ...args),
};
