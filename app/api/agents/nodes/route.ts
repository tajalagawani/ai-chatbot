// app/(chat)/api/agent/nodes/route.ts
import { auth } from '@/app/(auth)/auth';
import {
  getAgentNodesByDocumentId,
  getAgentNodeById,
  saveAgentNode,
  updateAgentNodeProperty,
  deleteAgentNode,
  getDocumentById
} from '@/lib/db/neo4j-queries';
import { generateUUID } from '@/lib/utils';

export const maxDuration = 60;

// GET /api/agent/nodes?documentId=...
export async function GET(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent nodes GET request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const nodeId = searchParams.get('nodeId');
    
    console.log(`[${startTime}] Agent nodes GET params:`, { documentId, nodeId });

    if (!documentId) {
      console.error(`[${startTime}] Agent nodes GET error: Missing document ID parameter`);
      return new Response('Document ID is required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent nodes GET:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent nodes GET unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent nodes GET error: Document not found`);
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
        console.error(`[${startTime}] Agent nodes GET error: Node not found`);
        return new Response('Node not found', { status: 404 });
      }
      
      console.log(`[${startTime}] Node retrieved successfully`);
      return new Response(JSON.stringify(node), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Otherwise get all nodes for the document
    console.log(`[${startTime}] Retrieving all nodes for document: ${documentId}`);
    const nodes = await getAgentNodesByDocumentId({ documentId });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent nodes GET completed successfully, retrieved ${nodes.length} nodes`);
    
    return new Response(JSON.stringify(nodes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent nodes GET:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// POST /api/agent/nodes
export async function POST(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent nodes POST request initiated`);
  
  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for agent nodes POST:`, { 
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Agent nodes POST unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const requestData = await request.json();
    const { 
      id, 
      documentId, 
      type, 
      label, 
      position_x, 
      position_y, 
      description, 
      operation, 
      properties 
    } = requestData;
    
    console.log(`[${startTime}] Agent nodes POST data:`, { 
      id, 
      documentId, 
      type,
      label
    });

    if (!id || !documentId) {
      console.error(`[${startTime}] Agent nodes POST error: Missing required parameters`);
      return new Response('Node ID and Document ID are required', { status: 400 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent nodes POST error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }
    
    console.log(`[${startTime}] Saving agent node`);
    await saveAgentNode({
      id: id,
      documentId,
      type: type || 'process',
      label: label || id,
      position_x: position_x || 0,
      position_y: position_y || 0,
      description: description || '',
      operation: operation || '',
      properties: properties || {},
      userId: session.user.id
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent node saved successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Node saved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent nodes POST:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// PATCH /api/agent/nodes
export async function PATCH(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent nodes PATCH request initiated`);
  
  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for agent nodes PATCH:`, { 
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent nodes PATCH unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    const requestData = await request.json();
    const { nodeId, documentId, propertyKey, propertyValue } = requestData;
    
    console.log(`[${startTime}] Agent nodes PATCH data:`, { 
      nodeId, 
      documentId, 
      propertyKey
    });

    if (!nodeId || !documentId || !propertyKey) {
      console.error(`[${startTime}] Agent nodes PATCH error: Missing required parameters`);
      return new Response('Node ID, Document ID, and property key are required', { status: 400 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent nodes PATCH error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }
    
    console.log(`[${startTime}] Updating agent node property: ${propertyKey}`);
    await updateAgentNodeProperty({
      nodeId,
      documentId,
      propertyKey,
      propertyValue
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent node property updated successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Node property updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent nodes PATCH:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}

// DELETE /api/agent/nodes?nodeId=...&documentId=...
export async function DELETE(request: Request) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent nodes DELETE request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const documentId = searchParams.get('documentId');
    
    console.log(`[${startTime}] Agent nodes DELETE params:`, { nodeId, documentId });

    if (!nodeId || !documentId) {
      console.error(`[${startTime}] Agent nodes DELETE error: Missing required parameters`);
      return new Response('Node ID and Document ID are required', { status: 400 });
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent nodes DELETE:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent nodes DELETE unauthorized: No valid session`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent nodes DELETE error: Document not found`);
      return new Response('Document not found', { status: 404 });
    }

    console.log(`[${startTime}] Deleting agent node: ${nodeId}`);
    await deleteAgentNode({
      nodeId,
      documentId
    });
    
    const endTime = new Date().toISOString();
    console.log(`[${endTime}] Agent node deleted successfully`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Node deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent nodes DELETE:`, error);
    return new Response(`Server error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}