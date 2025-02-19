import { auth } from '@/app/(auth)/auth';
import { getDocumentById } from '@/lib/db/queries';
import { ExecutionManager } from '@/lib/act/execution';
import { ActValidator } from '@/artifacts/code/server';

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

    // Parse ACT content
    const validator = new ActValidator(document.content);
    const parsedWorkflow = validator.parseContent();
    
    if (!validator.validate()) {
      return Response.json({
        success: false,
        error: 'Invalid workflow configuration'
      }, { status: 400 });
    }

    // Execute the workflow
    const executionManager = new ExecutionManager();
    const result = await executionManager.execute_workflow(parsedWorkflow);
    
    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

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