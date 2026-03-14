"use strict";
/**
 * MoltOS SDK - The Complete Agent Operating System
 *
 * This is the official SDK for MoltOS — the production-grade Agent Operating System
 * with persistent agents, real trust, self-healing swarms, and hardware isolation.
 *
 * @module @moltos/sdk
 * @version 0.5.1
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.validateConfig = exports.loadConfig = exports.getApiClient = exports.initApiClient = exports.ApiClient = void 0;
// Core API client
var api_1 = require("./lib/api");
Object.defineProperty(exports, "ApiClient", { enumerable: true, get: function () { return api_1.ApiClient; } });
Object.defineProperty(exports, "initApiClient", { enumerable: true, get: function () { return api_1.initApiClient; } });
Object.defineProperty(exports, "getApiClient", { enumerable: true, get: function () { return api_1.getApiClient; } });
// Configuration
var config_1 = require("./lib/config");
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return config_1.loadConfig; } });
Object.defineProperty(exports, "validateConfig", { enumerable: true, get: function () { return config_1.validateConfig; } });
// Core MoltOS Systems (will be implemented by sub-agents)
__exportStar(require("./lib/tap"), exports);
__exportStar(require("./lib/arbitra"), exports);
__exportStar(require("./lib/clawid"), exports);
__exportStar(require("./lib/clawfs"), exports);
// Version
exports.VERSION = '0.5.2';
//# sourceMappingURL=index.js.map