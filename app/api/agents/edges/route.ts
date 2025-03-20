// app/(chat)/api/agent/edges/route.ts
import { auth } from '@/app/(auth)/auth';
import {
  getAgentEdgesByDocumentId,
  saveAgentEdge,
  getAgentNodesByDocumentId,
  saveAgent,
  getDocumentById
} from '@/lib/db/neo4j-queries';
import { generateUUID } from '@/lib/utils';

export const maxDuration = 60;

// GET /api/agent/edges?documentId=...
export async function GET(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent edges GET request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    
    console.log(`[${startTime}] Agent edges GET params:`, { documentId });

    if (!documentId) {
      console.error(`[${startTime}] Agent edges GET error: Missing document ID parameter`);
      return new Response('Document ID is required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent edges GET:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent edges GET unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent edges GET error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }
    
    console.log(`[${startTime}] Retrieving edges for document: ${documentId}`);
    const edges = await getAgentEdgesByDocumentId({ documentId });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent edges GET completed successfully, retrieved ${edges.length} edges`);
    
    return new Response(JSON.stringify(edges), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent edges GET:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// POST /api/agent/edges
export async function POST(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent edges POST request initiated`);
  
  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for agent edges POST:`, { 
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Agent edges POST unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const requestData = await request.json();
    const { sourceNodeId, targetNodeId, documentId } = requestData;
    
    console.log(`[${startTime}] Agent edges POST data:`, { 
      sourceNodeId, 
      targetNodeId, 
      documentId
    });

    if (!sourceNodeId || !targetNodeId || !documentId) {
      console.error(`[${startTime}] Agent edges POST error: Missing required parameters`);
      return new Response('Source node ID, target node ID, and document ID are required', { status: 400 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent edges POST error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }
    
    console.log(`[${startTime}] Creating agent edge: ${sourceNodeId} -> ${targetNodeId}`);
    await saveAgentEdge({
      sourceNodeId,
      targetNodeId,
      documentId,
      userId: session.user.id
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent edge created successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Edge created successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent edges POST:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// DELETE /api/agent/edges?sourceNodeId=...&targetNodeId=...&documentId=...
export async function DELETE(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent edges DELETE request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const sourceNodeId = searchParams.get('sourceNodeId');
    const targetNodeId = searchParams.get('targetNodeId');
    const documentId = searchParams.get('documentId');
    
    console.log(`[${startTime}] Agent edges DELETE params:`, { sourceNodeId, targetNodeId, documentId });

    if (!sourceNodeId || !targetNodeId || !documentId) {
      console.error(`[${startTime}] Agent edges DELETE error: Missing required parameters`);
      return new Response('Source node ID, target node ID, and document ID are required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent edges DELETE:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent edges DELETE unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent edges DELETE error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    // Get all existing edges
    console.log(`[${startTime}] Retrieving all edges for document: ${documentId}`);
    const allEdges = await getAgentEdgesByDocumentId({ documentId });
    
    // Filter out the edge to delete
    const updatedEdges = allEdges
      .filter(edge => !(edge.source === sourceNodeId && edge.target === targetNodeId))
      .map(edge => ({ source: edge.source, target: edge.target }));
    
    // Get all nodes
    console.log(`[${startTime}] Retrieving all nodes for document: ${documentId}`);
    const nodes = await getAgentNodesByDocumentId({ documentId });
    const nodesMap = nodes.reduce((map, node) => {
      map[node.id] = {
        id: node.id,
        type: node.type,
        label: node.label,
        position_x: node.position_x,
        position_y: node.position_y,
        description: node.description,
        operation: node.operation,
        ...node.properties
      };
      return map;
    }, {});
    
    // Save the agent with updated edges
    console.log(`[${startTime}] Saving agent with updated edges (removing ${sourceNodeId} -> ${targetNodeId})`);
    await saveAgent({
      documentId,
      nodes: nodesMap,
      edges: updatedEdges,
      userId: session.user.id
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent edge deleted successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Edge deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent edges DELETE:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}