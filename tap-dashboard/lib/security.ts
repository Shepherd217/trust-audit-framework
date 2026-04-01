/**
 * Security middleware for API routes
 * 
 * Features:
 * - Rate limiting per IP
 * - Request size limiting
 * - CORS protection
 * - Security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Upstash Redis — real distributed rate limiting
let _redis: Redis | null = null
let _limiters: Map<string, Ratelimit> = new Map()

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}

function getLimiter(key: string, requests: number, windowSec: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const mapKey = `${requests}:${windowSec}`
  if (!_limiters.has(mapKey)) {
    _limiters.set(mapKey, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
      prefix: `rl:${key}`,
    }))
  }
  return _limiters.get(mapKey)!
}

// Fallback in-memory store for local dev (no Upstash configured)
const _memStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  requests: number;    // Max requests
  windowMs: number;    // Time window in milliseconds
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requests: 100,
  windowMs: 60 * 1000, // 1 minute
};

const STRICT_RATE_LIMIT: RateLimitConfig = {
  requests: 10,
  windowMs: 60 * 1000, // 1 minute
};

// Named tiers (used when calling applyRateLimit with a tier name instead of path)
const TIER_LIMITS: Record<string, RateLimitConfig> = {
  read:     { requests: 120, windowMs: 60 * 1000 },  // read-only, generous
  standard: { requests: 60,  windowMs: 60 * 1000 },  // general writes
  critical: { requests: 15,  windowMs: 60 * 1000 },  // financial / reputation ops
};

// Expensive endpoints get stricter limits
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/bls/verify': { requests: 30, windowMs: 60 * 1000 },
  '/api/bls/aggregate': { requests: 20, windowMs: 60 * 1000 },
  '/api/attest': { requests: 10, windowMs: 60 * 1000 },
  '/api/agent/attest': { requests: 10, windowMs: 60 * 1000 },
  '/api/agent/register': { requests: 5, windowMs: 60 * 1000 },
  '/api/deploy': { requests: 5, windowMs: 60 * 1000 },
  '/api/governance/vote': { requests: 20, windowMs: 60 * 1000 },
  '/api/governance/proposals': { requests: 30, windowMs: 60 * 1000 },
  '/api/marketplace/jobs': { requests: 30, windowMs: 60 * 1000 },
  '/api/user/deposit': { requests: 5, windowMs: 60 * 1000 },
  '/api/stripe/checkout': { requests: 10, windowMs: 60 * 1000 },
  '/api/stripe/portal': { requests: 10, windowMs: 60 * 1000 },
  '/api/upload': { requests: 10, windowMs: 60 * 1000 },
  '/api/clawfs/write': { requests: 20, windowMs: 60 * 1000 },
  '/api/topup': { requests: 10, windowMs: 60 * 1000 },
  '/api/stripe/webhook': { requests: 100, windowMs: 60 * 1000 },
  default: DEFAULT_RATE_LIMIT,
};

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Check rate limit for a key — uses Upstash Redis if configured, falls back to in-memory
 */
async function checkRateLimit(key: string, config: RateLimitConfig): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const windowSec = Math.ceil(config.windowMs / 1000);
  const limiter = getLimiter(key, config.requests, windowSec);

  if (limiter) {
    // Upstash path
    const { success, remaining, reset } = await limiter.limit(key);
    return { allowed: success, remaining, resetTime: reset };
  }

  // In-memory fallback (local dev — no Upstash configured)
  const now = Date.now();
  const record = _memStore.get(key);

  if (!record || now > record.resetTime) {
    _memStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.requests - 1, resetTime: now + config.windowMs };
  }

  if (record.count >= config.requests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: config.requests - record.count, resetTime: record.resetTime };
}

/**
 * Apply rate limiting to a request
 */
export async function applyRateLimit(
  request: NextRequest,
  path: string
): Promise<{ response?: NextResponse; headers: Record<string, string> }> {
  const ip = getClientIP(request);
  const config = TIER_LIMITS[path] || RATE_LIMITS[path] || RATE_LIMITS.default;
  const key = `${ip}:${path}`;

  const result = await checkRateLimit(key, config);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': config.requests.toString(),
    'X-RateLimit-Remaining': Math.max(0, result.remaining).toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  };

  if (!result.allowed) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retry_after_ms: result.resetTime - Date.now(),
      },
      { status: 429 }
    );

    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return { response, headers };
  }

  return { headers };
}

/**
 * Validate request body size
 */
export function validateBodySize(body: string, maxSizeKB: number = 100): { valid: boolean; error?: string } {
  const sizeKB = Buffer.byteLength(body, 'utf8') / 1024;
  
  if (sizeKB > maxSizeKB) {
    return {
      valid: false,
      error: `Request body too large. Max ${maxSizeKB}KB allowed. Received ${Math.round(sizeKB)}KB.`,
    };
  }
  
  return { valid: true };
}

/**
 * Validate array input length (prevent DoS with huge arrays)
 */
export function validateArrayLength(
  arr: any[],
  maxLength: number,
  name: string = 'array'
): { valid: boolean; error?: string } {
  if (!Array.isArray(arr)) {
    return { valid: true }; // Not an array, skip
  }
  
  if (arr.length > maxLength) {
    return {
      valid: false,
      error: `${name} too long. Max ${maxLength} items allowed. Received ${arr.length}.`,
    };
  }
  
  return { valid: true };
}

/**
 * Security headers for all API responses
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  // Always advertise latest SDK version in response headers
  response.headers.set('X-MoltOS-Latest-SDK', '0.19.5');
  response.headers.set('X-MoltOS-Latest-Python', '1.2.5');
  return response;
}

const MIN_SDK_VERSION = '0.19.0';

function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

/**
 * Check X-SDK-Version header — return 426 if below minimum supported version.
 * Non-blocking: only fires if agent explicitly sends the header.
 */
export function checkSDKVersion(req: { headers: { get: (k: string) => string | null } }): NextResponse | null {
  const sdkVer = req.headers.get('x-sdk-version') || req.headers.get('x-moltos-sdk-version')
  if (!sdkVer) return null // no header = pass through (backwards compat)
  if (semverLt(sdkVer, MIN_SDK_VERSION)) {
    return NextResponse.json({
      error: `SDK version ${sdkVer} is no longer supported. Minimum: ${MIN_SDK_VERSION}.`,
      upgrade: 'npm install @moltos/sdk@latest  OR  pip install moltos --upgrade',
      latest_sdk: '0.19.5',
      latest_python: '1.2.5',
    }, { status: 426 })
  }
  return null
}

/**
 * Validate hex string format
 */
export function validateHex(input: string, expectedBytes: number, name: string): { valid: boolean; error?: string } {
  const hex = input.replace(/^0x/, '');
  const expectedLength = expectedBytes * 2;
  
  if (hex.length !== expectedLength) {
    return {
      valid: false,
      error: `${name} invalid length. Expected ${expectedBytes} bytes (${expectedLength} hex chars), got ${hex.length / 2} bytes.`,
    };
  }
  
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    return {
      valid: false,
      error: `${name} contains invalid hex characters.`,
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check if request origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Allow non-browser requests
  
  const allowedOrigins = [
    'https://moltos.org',
    'https://www.moltos.org',
    'https://moltos.vercel.app',
    'http://localhost:3000',
  ];
  
  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Extract API key from request — accepts both:
 *   Authorization: Bearer moltos_sk_xxx
 *   x-api-key: moltos_sk_xxx
 */
export function getApiKey(request: import('next/server').NextRequest): string | null {
  // Authorization: Bearer takes priority
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim() || null
  }
  // Fall back to x-api-key
  return request.headers.get('x-api-key')
}
