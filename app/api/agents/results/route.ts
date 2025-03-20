// app/api/agents/results/route.ts
import { auth } from '@/app/(auth)/auth';
import { getSession } from '@/lib/db/neo4j';
import { getDocumentById } from './../../../../lib/db/neo4j-queries';
import { generateUUID } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// GET /api/agents/results?documentId=...&executionId=...&nodeId=...&withPrevious=true
export async function GET(request: NextRequest) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent results GET request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const executionId = searchParams.get('executionId');
    const nodeId = searchParams.get('nodeId');
    const withPrevious = searchParams.get('withPrevious') === 'true';
    
    console.log(`[${startTime}] Agent results GET params:`, { documentId, executionId, nodeId, withPrevious });

    if (!documentId) {
      console.error(`[${startTime}] Agent results GET error: Missing document ID parameter`);
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent results GET:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent results GET unauthorized: No valid session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent results GET error: Document not found`);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const dbSession = await getSession();
    try {
      let query;
      let params;
      
      if (nodeId) {
        // Get results for a specific node
        if (executionId) {
          if (withPrevious) {
            // Get results for a specific node plus its previous node's results
            query = `
              // Find the target node result
              MATCH (target:NodeResult {nodeId: $nodeId, documentId: $documentId, executionId: $executionId})
              
              // Optionally find the agent node to get its connections
              OPTIONAL MATCH (agentNode:AgentNode {id: $nodeId, documentId: $documentId})
              
              // Find previous nodes that connect to this node
              OPTIONAL MATCH (prevAgentNode:AgentNode {documentId: $documentId})-[:CONNECTS_TO]->(agentNode)
              
              // Find results for those previous nodes from the same execution
              OPTIONAL MATCH (prevResult:NodeResult {nodeId: prevAgentNode.id, documentId: $documentId, executionId: $executionId})
              
              RETURN target as r, collect(prevResult) as previousResults
            `;
          } else {
            // Get just the specific node result for a specific execution
            query = `
              MATCH (r:NodeResult {nodeId: $nodeId, documentId: $documentId, executionId: $executionId})
              RETURN r
              ORDER BY r.startedAt DESC
            `;
          }
          params = { nodeId, documentId, executionId };
          console.log(`[${startTime}] Querying specific node result for execution`);
        } else {
          if (withPrevious) {
            // Get the latest results for the node plus its previous node's results
            query = `
              // Find the latest execution for this node
              MATCH (target:NodeResult {nodeId: $nodeId, documentId: $documentId})
              WITH target ORDER BY target.startedAt DESC LIMIT 1
              
              // Optionally find the agent node to get its connections
              OPTIONAL MATCH (agentNode:AgentNode {id: $nodeId, documentId: $documentId})
              
              // Find previous nodes that connect to this node
              OPTIONAL MATCH (prevAgentNode:AgentNode {documentId: $documentId})-[:CONNECTS_TO]->(agentNode)
              
              // Find results for those previous nodes from the same execution
              OPTIONAL MATCH (prevResult:NodeResult {nodeId: prevAgentNode.id, documentId: $documentId, executionId: target.executionId})
              
              RETURN target as r, collect(prevResult) as previousResults
            `;
          } else {
            // Get just the latest result for the node
            query = `
              MATCH (r:NodeResult {nodeId: $nodeId, documentId: $documentId})
              RETURN r
              ORDER BY r.startedAt DESC
              LIMIT 1
            `;
          }
          params = { nodeId, documentId };
          console.log(`[${startTime}] Querying latest result for node`);
        }
      } else if (executionId) {
        // Get all results for a specific execution
        query = `
          MATCH (r:NodeResult {documentId: $documentId, executionId: $executionId})
          RETURN r
        `;
        params = { documentId, executionId };
        console.log(`[${startTime}] Querying all results for specific execution`);
      } else {
        // Get the latest execution results for the document
        query = `
          MATCH (r:NodeResult {documentId: $documentId})
          WITH r.executionId as execId, max(r.startedAt) as latestExecution
          ORDER BY latestExecution DESC
          LIMIT 1
          MATCH (result:NodeResult {documentId: $documentId, executionId: execId})
          RETURN result
        `;
        params = { documentId };
        console.log(`[${startTime}] Querying latest execution results for document`);
      }
      
      const result = await dbSession.run(query, params);
      
      if (withPrevious && nodeId) {
        // Format the result with previous node data
        const mainResult = result.records[0]?.get('r')?.properties;
        let previousResults = result.records[0]?.get('previousResults') || [];
        
        // Parse results
        if (mainResult) {
          try {
            if (typeof mainResult.result === 'string') {
              mainResult.result = JSON.parse(mainResult.result);
            }
          } catch (e) {
            console.error(`[${startTime}] Error parsing main result JSON:`, e);
            mainResult.result = { error: 'Failed to parse result data' };
          }
        }
        
        previousResults = previousResults
          .filter(res => res && res.properties)
          .map(res => {
            const props = res.properties;
            try {
              if (typeof props.result === 'string') {
                props.result = JSON.parse(props.result);
              }
            } catch (e) {
              console.error(`[${startTime}] Error parsing previous result JSON:`, e);
              props.result = { error: 'Failed to parse result data' };
            }
            return props;
          });
        
        const response = {
          nodeResult: mainResult || null,
          previousNodeResults: previousResults
        };
        
        const endTime = new Date().toISOString();
        console.log(`[${endTime}] Agent results GET with previous nodes completed successfully`);
        return NextResponse.json(response);
      } else {
        // Standard response format
        const nodeResults = result.records.map(record => {
          const resultNode = record.get('r') || record.get('result');
          if (!resultNode) return null;
          
          const properties = resultNode.properties;
          
          // Parse the result JSON string
          try {
            if (typeof properties.result === 'string') {
              properties.result = JSON.parse(properties.result);
            }
          } catch (e) {
            console.error(`[${startTime}] Error parsing result JSON:`, e);
            properties.result = { error: 'Failed to parse result data' };
          }
          
          return properties;
        }).filter(Boolean);
        
        const endTime = new Date().toISOString();
        console.log(`[${endTime}] Agent results GET completed successfully, retrieved ${nodeResults.length} results`);
        
        return NextResponse.json(nodeResults);
      }
    } finally {
      await dbSession.close();
    }
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent results GET:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve agent results' },
      { status: 500 }
    );
  }
}

// POST /api/agents/results
export async function POST(request: NextRequest) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent results POST request initiated`);
  
  try {
    const session = await auth();
    console.log(`[${startTime}] Auth for agent results POST:`, { 
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user || !session.user.id) {
      console.error(`[${startTime}] Agent results POST unauthorized: No valid session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      nodeId, 
      documentId, 
      executionId, 
      status, 
      result, 
      error,
      startedAt,
      completedAt,
      sourceNodeIds
    } = body;
    
    console.log(`[${startTime}] Agent results POST data:`, { 
      nodeId, 
      documentId, 
      executionId,
      status,
      sourceNodeIds: sourceNodeIds || 'none'
    });

    if (!nodeId || !documentId || !executionId) {
      console.error(`[${startTime}] Agent results POST error: Missing required parameters`);
      return NextResponse.json(
        { error: 'Node ID, Document ID, and Execution ID are required' },
        { status: 400 }
      );
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent results POST error: Document not found`);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    const id = generateUUID();
    const serializedResult = typeof result === 'object' ? JSON.stringify(result) : result;
    const startTimestamp = startedAt || new Date().toISOString();
    const completeTimestamp = completedAt || (status === 'completed' ? new Date().toISOString() : undefined);
    
    console.log(`[${startTime}] Saving result for node with status: ${status}`);
    const dbSession = await getSession();
    try {
      // First save the node result
      await dbSession.run(
        `
        CREATE (r:NodeResult {
          id: $id,
          nodeId: $nodeId,
          documentId: $documentId,
          executionId: $executionId,
          status: $status,
          result: $result,
          error: $error,
          startedAt: $startedAt,
          completedAt: $completedAt,
          createdAt: $createdAt
        })
        RETURN r
        `,
        {
          id,
          nodeId,
          documentId,
          executionId,
          status,
          result: serializedResult,
          error: error || '',
          startedAt: startTimestamp,
          completedAt: completeTimestamp || '',
          createdAt: new Date().toISOString()
        }
      );
      
      // If sourceNodeIds is provided, also create USED_RESULT relationships
      if (sourceNodeIds && Array.isArray(sourceNodeIds) && sourceNodeIds.length > 0) {
        console.log(`[${startTime}] Creating relationships to source node results: ${sourceNodeIds.join(', ')}`);
        
        for (const sourceNodeId of sourceNodeIds) {
          // Find the most recent result for this source node in the same execution
          const sourceResult = await dbSession.run(
            `
            MATCH (source:NodeResult {nodeId: $sourceNodeId, documentId: $documentId, executionId: $executionId})
            WITH source ORDER BY source.startedAt DESC LIMIT 1
            MATCH (target:NodeResult {id: $targetId})
            CREATE (target)-[r:USED_RESULT]->(source)
            RETURN r
            `,
            {
              sourceNodeId,
              documentId,
              executionId,
              targetId: id
            }
          );
          
          console.log(`[${startTime}] Created relationship from result ${id} to source ${sourceNodeId} (${sourceResult.records.length} records)`);
        }
      } else {
        // If no sourceNodeIds provided, try to infer them from the agent node structure
        console.log(`[${startTime}] No source nodes explicitly provided, inferring from agent structure`);
        
        await dbSession.run(
          `
          // Find the agent node
          MATCH (targetNode:AgentNode {id: $nodeId, documentId: $documentId})
          
          // Find all agent nodes that connect to this node
          MATCH (sourceNode:AgentNode {documentId: $documentId})-[:CONNECTS_TO]->(targetNode)
          
          // Find the most recent result for each source node in the same execution
          MATCH (sourceResult:NodeResult {nodeId: sourceNode.id, documentId: $documentId, executionId: $executionId})
          WITH sourceResult ORDER BY sourceResult.startedAt DESC LIMIT 1
          
          // Create relationship from this result to the source result
          MATCH (targetResult:NodeResult {id: $targetId})
          CREATE (targetResult)-[r:USED_RESULT]->(sourceResult)
          RETURN count(r) as relationshipsCreated
          `,
          {
            nodeId,
            documentId,
            executionId,
            targetId: id
          }
        );
      }
      
      const endTime = new Date().toISOString();
      console.log(`[${endTime}] Agent result saved successfully with id: ${id}`);
      
      return NextResponse.json({
        success: true,
        message: 'Node result saved successfully',
        id
      });
    } finally {
      await dbSession.close();
    }
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent results POST:`, error);
    return NextResponse.json(
      { error: 'Failed to save agent result' },
      { status: 500 }
    );
  }
}

// GET /api/agents/results/previous?documentId=...&nodeId=...&executionId=...
export async function getSourceNodeResults(request: NextRequest) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Source node results GET request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const nodeId = searchParams.get('nodeId');
    const executionId = searchParams.get('executionId');
    
    console.log(`[${startTime}] Source node results GET params:`, { documentId, nodeId, executionId });

    if (!documentId || !nodeId) {
      console.error(`[${startTime}] Source node results GET error: Missing required parameters`);
      return NextResponse.json(
        { error: 'Document ID and Node ID are required' },
        { status: 400 }
      );
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for source node results GET:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Source node results GET unauthorized: No valid session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const dbSession = await getSession();
    try {
      let query;
      let params;
      
      if (executionId) {
        // Find source node results for a specific execution
        query = `
          // Find the agent node
          MATCH (targetNode:AgentNode {id: $nodeId, documentId: $documentId})
          
          // Find all agent nodes that connect to this node
          MATCH (sourceNode:AgentNode {documentId: $documentId})-[:CONNECTS_TO]->(targetNode)
          
          // Find the most recent result for each source node in the same execution
          MATCH (sourceResult:NodeResult {nodeId: sourceNode.id, documentId: $documentId, executionId: $executionId})
          WITH sourceNode, sourceResult ORDER BY sourceResult.startedAt DESC
          
          RETURN sourceNode.id as nodeId, sourceNode.label as nodeLabel, collect(sourceResult)[0] as result
        `;
        params = { nodeId, documentId, executionId };
      } else {
        // Find the most recent source node results
        query = `
          // Find the agent node
          MATCH (targetNode:AgentNode {id: $nodeId, documentId: $documentId})
          
          // Find all agent nodes that connect to this node
          MATCH (sourceNode:AgentNode {documentId: $documentId})-[:CONNECTS_TO]->(targetNode)
          
          // Find the most recent result for each source node
          OPTIONAL MATCH (sourceResult:NodeResult {nodeId: sourceNode.id, documentId: $documentId})
          WITH sourceNode, sourceResult ORDER BY sourceResult.startedAt DESC
          
          RETURN sourceNode.id as nodeId, sourceNode.label as nodeLabel, collect(sourceResult)[0] as result
        `;
        params = { nodeId, documentId };
      }
      
      const result = await dbSession.run(query, params);
      
      const sourceResults = result.records.map(record => {
        const nodeId = record.get('nodeId');
        const nodeLabel = record.get('nodeLabel');
        const resultNode = record.get('result');
        
        if (!resultNode) {
          return {
            nodeId,
            nodeLabel,
            hasResult: false
          };
        }
        
        const properties = resultNode.properties;
        
        // Parse the result JSON string
        try {
          if (typeof properties.result === 'string') {
            properties.result = JSON.parse(properties.result);
          }
        } catch (e) {
          console.error(`[${startTime}] Error parsing result JSON:`, e);
          properties.result = { error: 'Failed to parse result data' };
        }
        
        return {
          nodeId,
          nodeLabel,
          hasResult: true,
          result: properties
        };
      });
      
      const endTime = new Date().toISOString();
      console.log(`[${endTime}] Source node results GET completed successfully, retrieved ${sourceResults.length} results`);
      
      return NextResponse.json(sourceResults);
    } finally {
      await dbSession.close();
    }
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Source node results GET:`, error);
    return NextResponse.json(
      { error: 'Failed to retrieve source node results' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/results?executionId=...&documentId=...
export async function DELETE(request: NextRequest) {
  const startTime = new Date().toISOString();
  console.log(`[${startTime}] Agent results DELETE request initiated`);
  
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');
    const documentId = searchParams.get('documentId');
    const nodeId = searchParams.get('nodeId');
    
    console.log(`[${startTime}] Agent results DELETE params:`, { executionId, documentId, nodeId });

    if (!documentId) {
      console.error(`[${startTime}] Agent results DELETE error: Missing document ID parameter`);
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const session = await auth();
    console.log(`[${startTime}] Auth for agent results DELETE:`, { 
      documentId,
      userId: session?.user?.id,
      isAuthenticated: !!session?.user
    });

    if (!session || !session.user) {
      console.error(`[${startTime}] Agent results DELETE unauthorized: No valid session`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify document exists and user has access
    console.log(`[${startTime}] Retrieving document with ID: ${documentId}`);
    const document = await getDocumentById({ id: documentId });
    
    if (!document) {
      console.error(`[${startTime}] Agent results DELETE error: Document not found`);
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const dbSession = await getSession();
    try {
      let query;
      let params;
      
      if (nodeId && executionId) {
        // Delete results for a specific node in a specific execution and their relationships
        query = `
          MATCH (r:NodeResult {nodeId: $nodeId, documentId: $documentId, executionId: $executionId})
          OPTIONAL MATCH (r)-[rel:USED_RESULT]-()
          DELETE rel, r
          RETURN count(r) as count
        `;
        params = { nodeId, documentId, executionId };
      } else if (executionId) {
        // Delete all results for a specific execution and their relationships
        query = `
          MATCH (r:NodeResult {documentId: $documentId, executionId: $executionId})
          OPTIONAL MATCH (r)-[rel:USED_RESULT]-()
          DELETE rel, r
          RETURN count(r) as count
        `;
        params = { documentId, executionId };
      } else if (nodeId) {
        // Delete all results for a specific node and their relationships
        query = `
          MATCH (r:NodeResult {nodeId: $nodeId, documentId: $documentId})
          OPTIONAL MATCH (r)-[rel:USED_RESULT]-()
          DELETE rel, r
          RETURN count(r) as count
        `;
        params = { nodeId, documentId };
      } else {
        // Delete all results for a document and their relationships
        query = `
          MATCH (r:NodeResult {documentId: $documentId})
          OPTIONAL MATCH (r)-[rel:USED_RESULT]-()
          DELETE rel, r
          RETURN count(r) as count
        `;
        params = { documentId };
      }
      
      console.log(`[${startTime}] Deleting agent results with query params:`, params);
      const result = await dbSession.run(query, params);
      const count = result.records[0].get('count').toNumber();
      
      const endTime = new Date().toISOString();
      console.log(`[${endTime}] Agent results DELETE completed successfully, deleted ${count} results`);
      
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${count} result(s)`,
        count
      });
    } finally {
      await dbSession.close();
    }
  } catch (error) {
    const errorTime = new Date().toISOString();
    console.error(`[${errorTime}] Unhandled exception in Agent results DELETE:`, error);
    return NextResponse.json(
      { error: 'Failed to delete agent results' },
      { status: 500 }
    );
  }
}