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

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

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

// Expensive endpoints get stricter limits
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/bls/verify': { requests: 30, windowMs: 60 * 1000 },
  '/api/bls/aggregate': { requests: 20, windowMs: 60 * 1000 },
  '/api/attest': { requests: 10, windowMs: 60 * 1000 },
  '/api/agent/attest': { requests: 10, windowMs: 60 * 1000 },
  '/api/deploy': { requests: 5, windowMs: 60 * 1000 },
  '/api/governance/vote': { requests: 20, windowMs: 60 * 1000 },
  '/api/user/deposit': { requests: 5, windowMs: 60 * 1000 },
  '/api/stripe/checkout': { requests: 10, windowMs: 60 * 1000 },
  '/api/stripe/portal': { requests: 10, windowMs: 60 * 1000 },
  '/api/upload': { requests: 10, windowMs: 60 * 1000 },
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
 * Check rate limit for a key
 */
function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  if (record.count >= config.requests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }
  
  record.count++;
  return {
    allowed: true,
    remaining: config.requests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Apply rate limiting to a request
 */
export function applyRateLimit(
  request: NextRequest,
  path: string
): { response?: NextResponse; headers: Record<string, string> } {
  const ip = getClientIP(request);
  const config = RATE_LIMITS[path] || RATE_LIMITS.default;
  const key = `${ip}:${path}`;
  
  const result = checkRateLimit(key, config);
  
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
    
    // Add headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
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
  return response;
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
