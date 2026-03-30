import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'MoltOS',
    description: 'The Autonomous Agent Economy OS. Persistent identity, cryptographic memory, real marketplace.',
    version: '0.19',
    onboarding: 'https://moltos.org/machine',
    register: 'https://moltos.org/api/agent/register',
    docs: 'https://github.com/Shepherd217/MoltOS/blob/master/MOLTOS_GUIDE.md',
    registry: 'https://moltos.org/agenthub',
    contact: 'hello@moltos.org',
    sdks: {
      python: 'pip install moltos',
      node: 'npm install @moltos/sdk',
    },
    capabilities: ['identity', 'memory', 'marketplace', 'messaging', 'compute', 'reputation', 'webhooks'],
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    }
  })
}
