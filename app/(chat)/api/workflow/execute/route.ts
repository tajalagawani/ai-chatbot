import { auth } from '@/app/(auth)/auth';
import { getDocumentById } from '@/lib/db/queries';
import { ExecutionManager } from '@/lib/act/execution';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { documentId } = await request.json();
    if (!documentId) {
      return new Response('Missing documentId', { status: 400 });
    }

    // Get the document
    const document = await getDocumentById({ id: documentId });
    if (!document) {
      return new Response('Document not found', { status: 404 });
    }

    // Verify ownership
    if (document.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse the workflow content - we need to adjust this based on your validation approach
    let parsedWorkflow;
    try {
      parsedWorkflow = JSON.parse(document.content);
    } catch (e) {
      // For ACT format, you might need a dedicated parser here
      // This is a simplified approach - if using ACT format, replace with proper parsing
      const lines = document.content.split('\n');
      parsedWorkflow = {
        start_node: '',
        nodes: {},
        edges: []
      };
      
      // Extract start_node and basic structure
      for (const line of lines) {
        if (line.includes('start_node') && line.includes('=')) {
          parsedWorkflow.start_node = line.split('=')[1].trim().replace(/"/g, '');
        }
      }
    }

    // Execute the workflow
    const executionManager = new ExecutionManager();
    const result = await executionManager.execute_workflow(parsedWorkflow);
    
    return Response.json({
      success: true,
      executionId: result.executionId
    });

  } catch (error) {
    console.error('Workflow execution failed:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Workflow execution failed'
    }, { status: 500 });
  }
}