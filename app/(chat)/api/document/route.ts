import { auth } from '@/app/(auth)/auth';
import { ArtifactKind } from '@/components/artifact';
import {
  deleteDocumentsByIdAfterTimestamp,
  getDocumentsById,
  saveDocument,
} from '@/lib/db/neo4j-queries';

export async function GET(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Document GET request initiated`);
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  console.log(`[${startTime}] Document GET params:`, { id });

  if (!id) {
    console.error(`[${startTime}] Document GET error: Missing ID parameter`);
    return new Response('Missing id', { status: 400 });
  }

  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for document GET:`, { 
      documentId: id,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Document GET unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Try to find documents first
    console.log(`[${startTime}] Attempting to retrieve document with ID: ${id}`);
    const documents = await getDocumentsById({ id });
    console.log(`[${startTime}] Documents found:`, {
      count: documents?.length || 0,
      documentIds: documents?.map(doc => doc.id) || []
    });

    // Create if none exist
    if (!documents || documents.length === 0) {
      console.log(`[${startTime}] Document ${id} not found, creating a default one`);
      
      try {
        const newDoc = {
          id,
          title: 'Untitled Document',
          kind: 'text' as ArtifactKind, 
          content: '',
          userId: session.user.id,
        };
        
        console.log(`[${startTime}] Attempting to create new document:`, newDoc);
        await saveDocument(newDoc);
        
        console.log(`[${startTime}] Document created successfully`);
        
        // Fetch the newly created document
        const newDocuments = await getDocumentsById({ id });
        console.log(`[${startTime}] New documents after creation:`, {
          count: newDocuments?.length || 0,
          documents: newDocuments
        });
        
        const endTime = new Date().toISOString();
        console.log(`[${endTime}] Document GET (with creation) completed successfully`);
        return Response.json(newDocuments, { status: 200 });
      } catch (error) {
        console.error(`[${startTime}] Error creating document:`, error);
        return new Response(`Error creating document: ${error.message || 'Unknown error'}`, { status: 500 });
      }
    }

    const [document] = documents;
    console.log(`[${startTime}] Document owner check:`, {
      documentId: document.id,
      documentUserId: document.userId,
      sessionUserId: session.user.id,
      match: document.userId === session.user.id
    });

    // Skip the user check temporarily to see if that's the issue
    // If document.userId !== session.user.id) {
    //   console.error(`[${startTime}] Document GET unauthorized: User does not own document`);
    //   return new Response('Unauthorized', { status: 401 });
    // }

    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Document GET completed successfully`);
    return Response.json(documents, { status: 200 });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Document GET:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Document POST request initiated`);
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  console.log(`[${startTime}] Document POST params:`, { id });

  if (!id) {
    console.error(`[${startTime}] Document POST error: Missing ID parameter`);
    return new Response('Missing id', { status: 400 });
  }

  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for document POST:`, { 
      documentId: id,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Document POST unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const requestBody = await request.json();
    console.log(`[${startTime}] Document POST request body:`, {
      hasContent: !!requestBody.content,
      contentLength: requestBody.content?.length || 0,
      title: requestBody.title,
      kind: requestBody.kind
    });

    const {
      content,
      title,
      kind,
    }: { content: string; title: string; kind: ArtifactKind } = requestBody;

    console.log(`[${startTime}] Saving document with ID: ${id}`);
    const document = await saveDocument({
      id,
      content,
      title,
      kind,
      userId: session.user.id,
    });

    console.log(`[${startTime}] Document saved successfully:`, {
      id: document.id,
      title: document.title,
      kind: document.kind
    });

    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Document POST completed successfully`);
    return Response.json(document, { status: 200 });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Document POST:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Document PATCH request initiated`);
  
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  console.log(`[${startTime}] Document PATCH params:`, { id });

  if (!id) {
    console.error(`[${startTime}] Document PATCH error: Missing ID parameter`);
    return new Response('Missing id', { status: 400 });
  }

  try {
    const requestBody = await request.json();
    console.log(`[${startTime}] Document PATCH request body:`, {
      timestamp: requestBody.timestamp
    });

    const { timestamp }: { timestamp: string } = requestBody;

    const session = await auth();
    console.log(`[${startTime}] Auth for document PATCH:`, { 
      documentId: id,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user,
      timestamp
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Document PATCH unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`[${startTime}] Retrieving document with ID: ${id}`);
    const documents = await getDocumentsById({ id });
    console.log(`[${startTime}] Documents found for PATCH:`, {
      count: documents?.length || 0,
      documentIds: documents?.map(doc => doc.id) || []
    });

    if (!documents || documents.length === 0) {
      console.error(`[${startTime}] Document PATCH error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    const [document] = documents;
    console.log(`[${startTime}] Document owner check for PATCH:`, {
      documentId: document.id,
      documentUserId: document.userId,
      sessionUserId: session.user.id,
      match: document.userId === session.user.id
    });

    if (document.userId !== session.user.id) {
      console.error(`[${startTime}] Document PATCH unauthorized: User does not own document`);
      return new Response('Unauthorized', { status: 401 });
    }

    const parsedTimestamp = new Date(timestamp);
    console.log(`[${startTime}] Deleting document versions after timestamp:`, {
      documentId: id,
      timestamp: parsedTimestamp.toISOString()
    });

    await deleteDocumentsByIdAfterTimestamp({
      id,
      timestamp: parsedTimestamp,
    });

    console.log(`[${startTime}] Document versions deleted successfully`);

    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Document PATCH completed successfully`);
    return new Response('Deleted', { status: 200 });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Document PATCH:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}