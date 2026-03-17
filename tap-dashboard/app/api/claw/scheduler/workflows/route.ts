import { NextRequest, NextResponse } from 'next/server';
import { createWorkflow, listWorkflows } from '@/lib/claw/scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.definition) {
      return NextResponse.json(
        { error: 'Missing workflow definition' },
        { status: 400 }
      );
    }

    const workflow = await createWorkflow(body.definition);
    return NextResponse.json({ success: true, workflow }, { status: 201 });
  } catch (error) {
    console.error('Create workflow error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate status
    const statusParam = searchParams.get('status');
    let status: 'active' | 'all' | 'inactive' | undefined;
    if (statusParam) {
      if (!['active', 'all', 'inactive'].includes(statusParam)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be active, all, or inactive' },
          { status: 400 }
        );
      }
      status = statusParam as 'active' | 'all' | 'inactive';
    }
    
    const filters = {
      owner: searchParams.get('owner') || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      status,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    const result = await listWorkflows(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('List workflows error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
