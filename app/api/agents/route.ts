// app/(chat)/api/agent/route.ts
import { auth } from '@/app/(auth)/auth';
import {
  getAgentByDocumentId,
  getAgentNodesByDocumentId,
  getAgentEdgesByDocumentId,
  saveAgentNode,
  saveAgentEdge,
  saveAgent,
  parseAndSaveAgentContent,
  getDocumentById,
  getAgentNodeById,
  updateAgentNodeProperty,
  deleteAgentNode,
} from '@/lib/db/neo4j-queries';
import { generateUUID } from '@/lib/utils';

export const maxDuration = 60;

// GET /api/agent?documentId=...
export async function GET(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent GET request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const nodeId = searchParams.get('nodeId');
    
    console.log(`[${startTime}] Agent GET params:`, { documentId, nodeId });

    if (!documentId) {
      console.error(`[${startTime}] Agent GET error: Missing document ID parameter`);
      return new Response('Document ID is required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent GET:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent GET unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent GET error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    // If nodeId is provided, get a specific node
    if (nodeId) {
      console.log(`[${startTime}] Retrieving specific node: ${nodeId}`);
      const node = await getAgentNodeById({ 
        nodeId, 
        documentId 
      });
      
      if (!node) {
        console.error(`[${startTime}] Agent GET error: Node not found`);
        return new Response('Node not found', { status: 404 });
      }
      
      console.log(`[${startTime}] Node retrieved successfully`);
      return new Response(JSON.stringify(node), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Otherwise get the full agent
    console.log(`[${startTime}] Retrieving full agent for document: ${documentId}`);
    const agent = await getAgentByDocumentId({ documentId });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent GET completed successfully`);
    
    return new Response(JSON.stringify(agent), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent GET:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// POST /api/agent
export async function POST(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent POST request initiated`);
  
  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for agent POST:`, { 
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Agent POST unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const requestData = await request.json();
    const { documentId, nodes, edges, content } = requestData;
    
    console.log(`[${startTime}] Agent POST data:`, { 
      documentId, 
      hasNodes: !!nodes,
      nodeCount: nodes ? Object.keys(nodes).length : 0,
      edgeCount: edges ? edges.length : 0,
      hasContent: !!content
    });

    if (!documentId) {
      console.error(`[${startTime}] Agent POST error: Missing document ID`);
      return new Response('Document ID is required', { status: 400 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent POST error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    // If content is provided, parse and save it
    if (content) {
      console.log(`[${startTime}] Parsing and saving agent content`);
      await parseAndSaveAgentContent({
        documentId,
        content,
        userId: session.user.id
      });
      
      const endTime = new Date().toISOString();
      console.log(`[${endTime}] Agent content saved successfully`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Agent content parsed and saved successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // If nodes and edges are provided, save them directly
    if (nodes && edges) {
      console.log(`[${startTime}] Saving agent nodes and edges`);
      await saveAgent({
        documentId,
        nodes,
        edges,
        userId: session.user.id
      });
      
      const endTime = new Date().toISOString();
      console.log(`[${endTime}] Agent saved successfully`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Agent saved successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.error(`[${startTime}] Agent POST error: Invalid request data`);
    return new Response(JSON.stringify({
      error: 'Either content or nodes/edges must be provided'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent POST:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// DELETE /api/agent?documentId=...
export async function DELETE(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent DELETE request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    
    console.log(`[${startTime}] Agent DELETE params:`, { documentId });

    if (!documentId) {
      console.error(`[${startTime}] Agent DELETE error: Missing document ID parameter`);
      return new Response('Document ID is required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent DELETE:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Agent DELETE unauthorized: No valid session or user ID`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent DELETE error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    // Delete all nodes for this document (this will also delete edges)
    console.log(`[${startTime}] Deleting agent for document: ${documentId}`);
    await saveAgent({
      documentId,
      nodes: {},
      edges: [],
      userId: session.user.id
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent DELETE completed successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Agent deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent DELETE:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Server error: ${errorMessage}`, { status: 500 });
  }
}