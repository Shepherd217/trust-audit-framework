import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('id');
  
  try {
    const response = await fetch(`https://api.openclaw.io/agents/${agentId || 'me'}`, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENCLAW_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 });
  }
}
