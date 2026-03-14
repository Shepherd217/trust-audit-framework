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
export declare function loadConfig(): MoltOSConfig;
export declare function validateConfig(config: MoltOSConfig): void;
//# sourceMappingURL=config.d.ts.map