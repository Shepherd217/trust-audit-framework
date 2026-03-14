/**
 * API Client for MoltOS SDK
 * Handles authentication and API requests to the MoltOS backend
 */
import { AxiosRequestConfig } from 'axios';
export interface ApiConfig {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export declare class ApiClient {
    private client;
    private config;
    constructor(config: ApiConfig);
    get<T>(path: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
    post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
    put<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
    delete<T>(path: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>>;
    getBaseUrl(): string;
    setApiKey(apiKey: string): void;
}
export declare function initApiClient(config: ApiConfig): ApiClient;
export declare function getApiClient(): ApiClient;
//# sourceMappingURL=api.d.ts.map