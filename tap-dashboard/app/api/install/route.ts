import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'install.sh');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return new NextResponse('Install script not found', { status: 404 });
  }
}
