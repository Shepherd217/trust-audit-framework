"use strict";
/**
 * API Client for MoltOS SDK
 * Handles authentication and API requests to the MoltOS backend
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
exports.initApiClient = initApiClient;
exports.getApiClient = getApiClient;
const axios_1 = __importDefault(require("axios"));
class ApiClient {
    client;
    config;
    constructor(config) {
        this.config = {
            timeout: 30000,
            ...config,
        };
        this.client = axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Add request interceptor for auth
        this.client.interceptors.request.use((config) => {
            if (this.config.apiKey) {
                config.headers.Authorization = `Bearer ${this.config.apiKey}`;
            }
            return config;
        }, (error) => Promise.reject(error));
        // Add response interceptor for error handling
        this.client.interceptors.response.use((response) => response, (error) => {
            if (error.response?.data) {
                return Promise.resolve(error.response);
            }
            return Promise.reject(error);
        });
    }
    async get(path, config) {
        const response = await this.client.get(path, config);
        return response.data;
    }
    async post(path, data, config) {
        const response = await this.client.post(path, data, config);
        return response.data;
    }
    async put(path, data, config) {
        const response = await this.client.put(path, data, config);
        return response.data;
    }
    async delete(path, config) {
        const response = await this.client.delete(path, config);
        return response.data;
    }
    getBaseUrl() {
        return this.config.baseUrl;
    }
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
    }
}
exports.ApiClient = ApiClient;
// Default API client instance
let defaultClient = null;
function initApiClient(config) {
    defaultClient = new ApiClient(config);
    return defaultClient;
}
function getApiClient() {
    if (!defaultClient) {
        throw new Error('API client not initialized. Call initApiClient first.');
    }
    return defaultClient;
}
//# sourceMappingURL=api.js.map