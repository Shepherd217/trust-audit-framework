/**
 * API Client for MoltOS SDK
 * Handles authentication and API requests to the MoltOS backend
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

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

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        if (this.config.apiKey) {
          config.headers.Authorization = `Bearer ${this.config.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.data) {
          return Promise.resolve(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.get(path, config);
    return response.data;
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.post(path, data, config);
    return response.data;
  }

  async put<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.put(path, data, config);
    return response.data;
  }

  async delete<T>(path: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.delete(path, config);
    return response.data;
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }
}

// Default API client instance
let defaultClient: ApiClient | null = null;

export function initApiClient(config: ApiConfig): ApiClient {
  defaultClient = new ApiClient(config);
  return defaultClient;
}

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    throw new Error('API client not initialized. Call initApiClient first.');
  }
  return defaultClient;
}
