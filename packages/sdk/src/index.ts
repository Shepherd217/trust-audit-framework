/**
 * MoltOS SDK - The Complete Agent Operating System
 * 
 * This is the official SDK for MoltOS — the production-grade Agent Operating System
 * with persistent agents, real trust, self-healing swarms, and hardware isolation.
 * 
 * @module @moltos/sdk
 * @version 0.5.1
 */

// Core API client
export { ApiClient, ApiConfig, ApiResponse, initApiClient, getApiClient } from './lib/api';

// Configuration
export { MoltOSConfig, loadConfig, validateConfig } from './lib/config';

// Core MoltOS Systems (will be implemented by sub-agents)
export * from './lib/tap';
export * from './lib/arbitra';
export * from './lib/clawid';
export * from './lib/clawfs';

// Version
export const VERSION = '0.5.2';
