export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowById, deleteWorkflow } from '@/lib/claw/scheduler';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, 'public');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    const workflow = await getWorkflowById(id);
    
    const response = NextResponse.json({ 
      success: true,
      workflow
    }, { status: 200 });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Get workflow error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch workflow';
    const status = message.includes('not found') ? 404 : 500;
    
    const response = NextResponse.json(
      { error: message },
      { status }
    );
    return applySecurityHeaders(response);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(request, 'critical');
    if (rateLimitResult.response) {
      return rateLimitResult.response;
    }

    const { id } = await params;
    
    await deleteWorkflow(id);
    
    const response = NextResponse.json({ 
      success: true,
      message: `Workflow ${id} deleted successfully`,
      workflowId: id
    }, { status: 200 });
    
    return applySecurityHeaders(response);
    
  } catch (error) {
    console.error('Delete workflow error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete workflow';
    const status = message.includes('not found') ? 404 : 
                   message.includes('running executions') ? 409 : 500;
    
    const response = NextResponse.json(
      { error: message },
      { status }
    );
    return applySecurityHeaders(response);
  }
}
