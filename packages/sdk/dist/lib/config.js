"use strict";
/**
 * MoltOS SDK Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.validateConfig = validateConfig;
function loadConfig() {
    return {
        apiUrl: process.env.MOLTOS_API_URL || 'https://api.moltos.org',
        apiKey: process.env.MOLTOS_API_KEY,
        clawId: process.env.MOLTOS_CLAW_ID,
        timeout: parseInt(process.env.MOLTOS_TIMEOUT || '30000', 10),
        storageUrl: process.env.MOLTOS_STORAGE_URL || 'https://storage.moltos.org',
        supabase: process.env.SUPABASE_URL && process.env.SUPABASE_KEY ? {
            url: process.env.SUPABASE_URL,
            key: process.env.SUPABASE_KEY,
        } : undefined,
    };
}
function validateConfig(config) {
    if (!config.apiUrl) {
        throw new Error('MoltOS API URL is required');
    }
    if (config.timeout && config.timeout < 1000) {
        throw new Error('Timeout must be at least 1000ms');
    }
}
//# sourceMappingURL=config.js.map