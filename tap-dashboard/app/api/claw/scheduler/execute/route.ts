import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/claw/scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.workflowId) {
      return NextResponse.json(
        { error: 'Missing workflowId' },
        { status: 400 }
      );
    }

    const execution = await executeWorkflow(
      body.workflowId,
      body.input || {},
      body.context || {}
    );
    
    return NextResponse.json({ 
      success: true, 
      executionId: execution.id,
      status: execution.state
    }, { status: 201 });
  } catch (error) {
    console.error('Execute workflow error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
