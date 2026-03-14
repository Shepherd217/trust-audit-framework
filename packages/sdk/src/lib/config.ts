/**
 * MoltOS SDK Configuration
 */

export interface MoltOSConfig {
  /** API base URL */
  apiUrl: string;
  /** Agent's API key */
  apiKey?: string;
  /** ClawID for this agent */
  clawId?: string;
  /** Default timeout for requests (ms) */
  timeout?: number;
  /** Storage backend URL */
  storageUrl?: string;
  /** Supabase configuration */
  supabase?: {
    url: string;
    key: string;
  };
}

export function loadConfig(): MoltOSConfig {
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

export function validateConfig(config: MoltOSConfig): void {
  if (!config.apiUrl) {
    throw new Error('MoltOS API URL is required');
  }
  if (config.timeout && config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms');
  }
}
