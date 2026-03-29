import { NextRequest, NextResponse } from 'next/server';
import { ed25519 } from '@noble/curves/ed25519';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { public_key, signature, challenge, content_hash, path, timestamp } = body;
    
    // Reconstruct payload
    const payload = { challenge, content_hash, path, timestamp };
    const sortedKeys = Object.keys(payload).sort() as (keyof typeof payload)[];
    
    // Try both compact (JS default) and spaced (Python default)
    const compactPayload = JSON.stringify(payload, sortedKeys);
    const spacedPayload = sortedKeys.reduce((acc: string, k: string, i: number) => {
      const val = JSON.stringify((payload as any)[k]);
      return acc + (i > 0 ? ', ' : '') + `"${k}": ${val}`;
    }, '{') + '}';
    
    const pubKeyBytes = new Uint8Array(Buffer.from(public_key, 'hex'));
    const sigBytes = new Uint8Array(Buffer.from(signature, 'base64'));
    
    let isValid = false;
    let isValidSpaced = false;
    let error = null;
    try {
      isValid = ed25519.verify(sigBytes, new TextEncoder().encode(compactPayload), pubKeyBytes);
      if (!isValid) {
        isValidSpaced = ed25519.verify(sigBytes, new TextEncoder().encode(spacedPayload), pubKeyBytes);
      }
    } catch (e: any) {
      error = e?.message || 'verify error';
    }
    
    return NextResponse.json({
      input: { public_key, signature, payload },
      processed: {
        compactPayload,
        spacedPayload,
        pubKeyLength: pubKeyBytes.length,
        sigLength: sigBytes.length
      },
      result: {
        isValid: isValid || isValidSpaced,
        isValidCompact: isValid,
        isValidSpaced,
        error
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
