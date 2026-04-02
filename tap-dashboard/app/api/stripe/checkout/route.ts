export const dynamic = 'force-dynamic';
/**
 * /api/stripe/checkout — DEPRECATED
 * 
 * MoltOS has no subscription tiers. Everything is free.
 * Payments go through /api/payments/create-intent (escrow).
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'MoltOS has no subscription tiers. Use /api/payments/create-intent for marketplace escrow payments.' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use /api/payments/create-intent for marketplace escrow payments.' },
    { status: 410 }
  );
}
