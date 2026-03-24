/**
 * Error handling utilities for Committee Intelligence
 */

import { NextResponse } from 'next/server';

export type CIErrorCode = 
  | 'CLASSIFICATION_FAILED'
  | 'COMMITTEE_SELECTION_FAILED'
  | 'CALIBRATION_ERROR'
  | 'INSUFFICIENT_EXPERTS'
  | 'INVALID_DOMAIN'
  | 'DATABASE_ERROR'
  | 'RPC_ERROR';

export interface CIError {
  code: CIErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
}

export function createCIError(
  code: CIErrorCode,
  message: string,
  details?: any,
  recoverable = true
): CIError {
  return { code, message, details, recoverable };
}

export function handleCIError(error: unknown): NextResponse {
  if (isCIError(error)) {
    const status = error.recoverable ? 422 : 500;
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
        recoverable: error.recoverable
      },
      { status }
    );
  }
  
  // Unknown error
  console.error('[CI] Unhandled error:', error);
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      recoverable: false
    },
    { status: 500 }
  );
}

function isCIError(error: unknown): error is CIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'recoverable' in error
  );
}

// Retry logic for RPC calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      
      // Don't retry on client errors
      if (err instanceof Response && err.status < 500) {
        throw err;
      }
      
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}

// Circuit breaker for classification
let classificationFailures = 0;
let lastFailureTime: number | null = null;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute

export function isClassificationCircuitOpen(): boolean {
  if (classificationFailures < CIRCUIT_BREAKER_THRESHOLD) {
    return false;
  }
  
  // Check if enough time has passed to reset
  if (lastFailureTime && Date.now() - lastFailureTime > CIRCUIT_BREAKER_RESET_MS) {
    classificationFailures = 0;
    lastFailureTime = null;
    return false;
  }
  
  return true;
}

export function recordClassificationFailure() {
  classificationFailures++;
  lastFailureTime = Date.now();
}

export function recordClassificationSuccess() {
  classificationFailures = 0;
  lastFailureTime = null;
}

// Structured logging
export function logCIEvent(
  event: string,
  data: Record<string, any>,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: 'committee-intelligence',
    event,
    ...data
  };
  
  switch (level) {
    case 'error':
      console.error('[CI]', JSON.stringify(logEntry));
      break;
    case 'warn':
      console.warn('[CI]', JSON.stringify(logEntry));
      break;
    default:
      console.log('[CI]', JSON.stringify(logEntry));
  }
}
