import { auth } from '@/app/(auth)/auth';
import { getRecentDocumentsByKind } from '@/lib/db/queries';
import { ArtifactKind } from '@/components/artifact';

export const maxDuration = 30; // 30 seconds max duration

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') as ArtifactKind | null;
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    if (!kind) {
      return new Response('Missing required parameter: kind', { status: 400 });
    }
    
    // Validate kind parameter
    const validKinds: ArtifactKind[] = ['text', 'code', 'sheet', 'image'];
    if (!validKinds.includes(kind)) {
      return new Response(`Invalid kind parameter. Must be one of: ${validKinds.join(', ')}`, { 
        status: 400 
      });
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch recent documents
    const documents = await getRecentDocumentsByKind({ 
      userId: session.user.id, 
      kind, 
      limit
    });

    // Return documents as JSON
    return Response.json(documents);
  } catch (error) {
    console.error('Error fetching recent documents:', error);
    return new Response('Internal server error', { status: 500 });
  }
}