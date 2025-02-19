import { auth } from '@/app/(auth)/auth';
import { getDocumentById } from '@/lib/db/queries';
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

    // Validate the workflow
    const validator = new ActValidator(document.content);
    const isValid = validator.validate();

    return Response.json({
      success: true,
      isValid,
      workflow: isValid ? validator.getWorkflow() : null
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 400 });
  }
}

// ======================================================
// File: /lib/act/types.ts
// ======================================================
export interface WorkflowExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface WorkflowValidationResult {
  success: boolean;
  isValid: boolean;
  workflow?: any;
  error?: string;
}