import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, getRecentDocumentsByKind, saveDocument, updateDocumentInPlace } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/models';
import { dockerService } from '@/lib/services/docker';

interface ExecuteWorkflowProps {
  session: Session;
  dataStream: DataStreamWriter;
}

// Tool description that explains how it works with dynamic ACT workflow execution
const TOOL_DESCRIPTION = `Execute operations using dynamically updated ACT workflow based on the user request.

This tool automatically:
1. Generates an initial workflow document based on the user's request
2. Executes the workflow node by node
3. After each node execution, updates the workflow document based on real data
4. Continues execution with the updated workflow
5. Returns the actual execution results`;

// Function to normalize workflow format
function normalizeWorkflowFormat(content: string): string {
  // Identify template syntax to preserve
  const templateBlocks = [];
  let processedContent = content;
  
  // Find and temporarily replace template syntax
  const templateRegex = /({%[\s\S]*?%}|{{[\s\S]*?}})/g;
  let match;
  let index = 0;
  
  while ((match = templateRegex.exec(content)) !== null) {
    const placeholder = `__TEMPLATE_PLACEHOLDER_${index}__`;
    templateBlocks.push({
      placeholder,
      original: match[0]
    });
    processedContent = processedContent.replace(match[0], placeholder);
    index++;
  }

  // Remove quotes around values
  let normalized = processedContent.replace(/=\s*"([^"]*)"/g, '= $1');
  
  // Find node sections and extract JSON params to flatten them
  const nodeRegex = /\[node:(.*?)\]([\s\S]*?)(?=\[|$)/g;
  
  while ((match = nodeRegex.exec(normalized)) !== null) {
    const nodeName = match[1];
    const nodeContent = match[2];
    
    // Check if there's a params JSON object
    const paramsMatch = nodeContent.match(/params\s*=\s*(\{[\s\S]*?\})/);
    if (paramsMatch) {
      try {
        // Parse the JSON
        const paramsJson = JSON.parse(paramsMatch[1].replace(/(\${[^}]*})/g, '"$1"'));
        let flattenedParams = '';
        
        // Create individual key=value pairs
        for (const [key, value] of Object.entries(paramsJson)) {
          const formattedValue = value.toString().startsWith('"${') && value.toString().endsWith('}"') 
            ? value.toString().substring(1, value.toString().length - 1) 
            : value;
          flattenedParams += `${key} = ${formattedValue}\n`;
        }
        
        // Replace the params JSON with flattened parameters
        const newNodeContent = nodeContent.replace(
          /params\s*=\s*(\{[\s\S]*?\})/,
          flattenedParams
        );
        
        // Update the normalized content
        normalized = normalized.replace(
          `[node:${nodeName}]${nodeContent}`,
          `[node:${nodeName}]${newNodeContent}`
        );
      } catch (e) {
        console.error('Error parsing params JSON:', e);
      }
    }
  }

  // Restore template placeholders
  for (const template of templateBlocks) {
    normalized = normalized.replace(template.placeholder, template.original);
  }
  
  return normalized;
}

// Function to validate workflow nodes against reference
function validateWorkflowNodes(newContent: string, referenceContent: string): string {
  // Extract node types and operations from reference
  const nodeRegex = /\[node:(.*?)\][\s\S]*?type\s*=\s*([^\n]+)[\s\S]*?operation\s*=\s*([^\n]+)/g;
  const validOperations = new Map();
  
  let match;
  while ((match = nodeRegex.exec(referenceContent)) !== null) {
    const nodeType = match[2].trim();
    const operation = match[3].trim();
    validOperations.set(`${nodeType}:${operation}`, true);
  }
  
  // Check new content's operations
  const newNodes = [];
  let newNodeMatch;
  const newNodeRegex = /\[node:(.*?)\]([\s\S]*?)(?=\[|$)/g;
  
  while ((newNodeMatch = newNodeRegex.exec(newContent)) !== null) {
    const nodeName = newNodeMatch[1];
    const nodeContent = newNodeMatch[2];
    
    // Extract type and operation
    const typeMatch = nodeContent.match(/type\s*=\s*([^\n]+)/);
    const operationMatch = nodeContent.match(/operation\s*=\s*([^\n]+)/);
    
    if (typeMatch && operationMatch) {
      const nodeType = typeMatch[1].trim();
      const operation = operationMatch[1].trim();
      const key = `${nodeType}:${operation}`;
      
      if (!validOperations.has(key)) {
        console.warn(`Invalid operation found: ${nodeName} uses ${nodeType}:${operation} which is not in the reference`);
        // Could implement more sophisticated fixes here
      }
    }
    
    newNodes.push({ name: nodeName, content: nodeContent });
  }
  
  return newContent;
}

// Helper function to create detailed context-aware summaries
function createDetailedSummary(operationResults: any[]): {
  summaryText: string;
  importantLinks: { label: string; url: string; nodeId: string; }[];
  errorDetails: { nodeId: string; operation: string; error: string; }[];
} {
  const successResults = operationResults.filter(r => r.status === 'success');
  const failedResults = operationResults.filter(r => r.status !== 'success');
  
  const importantLinks = [];
  const errorDetails = [];
  
  // Process successful operations
  for (const result of successResults) {
    try {
      if (result.rawResult) {
        // Extract URLs directly from the result
        const urls = extractUrlsFromResult(result.nodeId, result.operation, result.rawResult);
        importantLinks.push(...urls);
      }
    } catch (error) {
      console.error(`Error processing success result for ${result.nodeId}:`, error);
    }
  }
  
  // Process failed operations
  for (const result of failedResults) {
    try {
      let errorMessage = 'Unknown error';
      
      if (result.message) {
        errorMessage = result.message;
      } else if (typeof result.rawResult === 'object' && result.rawResult) {
        if (result.rawResult.message) {
          errorMessage = result.rawResult.message;
        } else if (result.rawResult.error) {
          errorMessage = typeof result.rawResult.error === 'string' 
            ? result.rawResult.error 
            : JSON.stringify(result.rawResult.error);
        }
      }
      
      errorDetails.push({
        nodeId: result.nodeId,
        operation: result.operation,
        error: errorMessage
      });
    } catch (error) {
      console.error(`Error processing failed result for ${result.nodeId}:`, error);
      errorDetails.push({
        nodeId: result.nodeId,
        operation: result.operation || 'unknown',
        error: 'Error details unavailable'
      });
    }
  }
  
  // Build a comprehensive summary text
  let summaryText = `${successResults.length} operations succeeded, ${failedResults.length} operations failed.`;
  
  // Add context-based information
  if (importantLinks.length > 0) {
    summaryText += ` ${importantLinks.length} important resources were created.`;
  }
  
  if (failedResults.length > 0) {
    summaryText += ` ${failedResults.length} operations encountered issues that need attention.`;
  }
  
  return {
    summaryText,
    importantLinks,
    errorDetails
  };
}

// Helper function to extract URLs from results
function extractUrlsFromResult(nodeId: string, operation: string, result: any): Array<{
  label: string;
  url: string;
  nodeId: string;
}> {
  const links = [];
  
  try {
    // Handle GitHub specific operations
    if (operation === 'create_repo' && result.html_url) {
      links.push({
        label: `Repository: ${result.name || 'New Repository'}`,
        url: result.html_url,
        nodeId
      });
    } else if (operation === 'create_issue' && result.html_url) {
      links.push({
        label: `Issue #${result.number}: ${result.title || 'New Issue'}`,
        url: result.html_url,
        nodeId
      });
    } else if (operation === 'create_file' && result.content?.html_url) {
      links.push({
        label: `File: ${result.content.path || 'New File'}`,
        url: result.content.html_url,
        nodeId
      });
    } else if (operation === 'create_pull_request' && result.html_url) {
      links.push({
        label: `PR #${result.number}: ${result.title || 'New PR'}`,
        url: result.html_url,
        nodeId
      });
    } else {
      // Generic URL extraction for other operations
      for (const key of ['html_url', 'url']) {
        if (result[key] && typeof result[key] === 'string') {
          links.push({
            label: `${operation}: ${result.title || result.name || 'Result'}`,
            url: result[key],
            nodeId
          });
          break; // Use the first URL we find
        }
      }
    }
  } catch (error) {
    console.error(`Error extracting URLs from ${operation} result:`, error);
  }
  
  return links;
}

// Function to parse workflow and extract nodes
function parseWorkflowNodes(workflowContent: string): {
  nodes: { id: string; nodeContent: string; }[];
  edges: Record<string, string>;
  otherSections: Record<string, string>;
} {
  // Extract node sections
  const nodeRegex = /\[node:(.*?)\]([\s\S]*?)(?=\[node:|$)/g;
  const nodes = [];
  let match;
  
  while ((match = nodeRegex.exec(workflowContent)) !== null) {
    const nodeId = match[1];
    const nodeContent = match[2];
    nodes.push({ id: nodeId, nodeContent: `[node:${nodeId}]${nodeContent}` });
  }
  
  // Extract edges section
  const edgesMatch = workflowContent.match(/\[edges\]([\s\S]*?)(?=\[|$)/);
  const edges = {};
  
  if (edgesMatch) {
    const edgesContent = edgesMatch[1];
    const edgeLines = edgesContent.trim().split('\n');
    
    for (const line of edgeLines) {
      if (line.includes('=')) {
        const [source, target] = line.split('=').map(part => part.trim());
        edges[source] = target;
      }
    }
  }
  
  // Extract other sections (parameters, workflow, settings, env)
  const otherSections = {};
  const sectionRegex = /\[(parameters|workflow|settings|env)\]([\s\S]*?)(?=\[|$)/g;
  let sectionMatch;
  
  while ((sectionMatch = sectionRegex.exec(workflowContent)) !== null) {
    const sectionName = sectionMatch[1];
    const sectionContent = sectionMatch[2];
    otherSections[sectionName] = `[${sectionName}]${sectionContent}`;
  }
  
  return { nodes, edges, otherSections };
}

// Function to generate edges section from nodes
function generateEdgesSection(nodes: string[]): string {
  if (nodes.length <= 1) {
    return '[edges]\n';
  }
  
  let edgesContent = '[edges]\n';
  
  for (let i = 0; i < nodes.length - 1; i++) {
    // Extract node ID from node content
    const idMatch = nodes[i].match(/\[node:(.*?)\]/);
    const nextIdMatch = nodes[i + 1].match(/\[node:(.*?)\]/);
    
    if (idMatch && nextIdMatch) {
      const nodeId = idMatch[1];
      const nextNodeId = nextIdMatch[1];
      edgesContent += `${nodeId} = ${nextNodeId}\n`;
    }
  }
  
  return edgesContent;
}

// Function to update workflow based on node execution result with enhanced template handling
async function updateWorkflowWithAI(
  initialWorkflow: string,
  currentNodeId: string,
  executionResult: any,
  userRequest: string,
  allExecutedNodes: { nodeId: string; result: any; status: string; executedAt: string }[],
  referenceContent: string
): Promise<string> {
  console.log(`Updating workflow after executing node: ${currentNodeId}`);
  console.log(`Raw execution result:`, JSON.stringify(executionResult, null, 2));
  
  try {
    // Format the execution results - preserve complete, unprocessed structure
    const resultDetails = JSON.stringify(executionResult, null, 2);
    const allPreviousResults = JSON.stringify(allExecutedNodes, null, 2);
    
    // Use AI to update the workflow with enhanced template handling instructions
    const { fullStream } = await streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: `You are an expert in creating and updating ACT workflow configurations. 
You'll be given the current workflow document, the results of the most recently executed node, 
and all previously executed nodes' results. Your task is to update the workflow to adapt to the real execution data.

IMPORTANT RULES:
1. DO NOT use quotation marks ("") around ANY values - all values must be unquoted
2. DO NOT use JSON format ANYWHERE - flatten all parameters into individual key=value pairs
3. Every parameter must be in format "key = value" (with space around the equals sign) 
4. Only use node types and operations that exist in the reference document
5. Preserve all required parameters for each operation type from the reference
6. DO NOT change or remove already executed nodes - they should remain exactly as they were

TEMPLATE SYNTAX HANDLING (CRITICAL):
7. PRESERVE ALL TEMPLATE EXPRESSIONS exactly as they appear in the workflow
8. Template expressions like {% for item in collection %} ... {% endfor %} must be kept intact
9. Variable references like {{ variable.path }} must be kept exactly as they are
10. Do not attempt to evaluate or modify any template expressions
11. Look at the raw execution results to understand available variables and their structure
12. When using {% for issue in list_issues.result %}, ensure list_issues.result exists in the execution results
13. Ensure all variable references like {{ issue.html_url }} match the structure in execution results
14. NEVER replace template syntax with actual values - the templating will happen at runtime`,
      
      prompt: `CURRENT WORKFLOW:
${initialWorkflow}

RECENTLY EXECUTED NODE: ${currentNodeId}
EXECUTION RESULT (DO NOT MODIFY OR EVALUATE THESE VALUES):
${resultDetails}

ALL PREVIOUSLY EXECUTED NODES:
${allPreviousResults}

USER'S ORIGINAL REQUEST: ${userRequest}

REFERENCE DOCUMENT CONTAINING VALID OPERATIONS:
${referenceContent}

INSTRUCTIONS:
1. Look at the execution result for the recently executed node ${currentNodeId}
2. Determine what changes are needed to the workflow based on the result
3. You can:
   - Update parameters for upcoming nodes based on the real data
   - Add new nodes if needed based on the results
   - Remove planned nodes that are no longer necessary
4. DO NOT change or remove nodes that have already been executed
5. Ensure the workflow remains valid and correctly connected
6. Return the complete updated workflow in the exact same format
7. PRESERVE ALL TEMPLATE EXPRESSIONS ({% %} and {{ }}) exactly as written
8. DO NOT try to evaluate or substitute values into template expressions

IMPORTANT: 
- Keep all existing sections: [parameters], [workflow], [nodes], [edges], [settings], [env]
- Keep all required parameters for each node type
- Make sure the workflow is properly connected with correct edges
- DO NOT use quotes around values
- Preserve all template syntax ({% %} and {{ }}) exactly as is`,
      
      schema: z.object({
        updatedWorkflow: z.string(),
        explanation: z.string(),
        recommendations: z.array(z.string()).optional(),
      }),
      temperature: 0,
      maxTokens: 70000,
    });
    
    let result = {
      updatedWorkflow: initialWorkflow,
      explanation: "No changes made to workflow",
      recommendations: []
    };
    
    for await (const chunk of fullStream) {
      if (chunk.type === 'object' && chunk.object) {
        result = chunk.object;
      }
    }
    
    console.log(`Workflow updated with explanation: ${result.explanation}`);

    // Verify that template syntax is preserved
    const initialTemplateMatches = initialWorkflow.match(/({%[\s\S]*?%}|{{[\s\S]*?}})/g) || [];
    const updatedTemplateMatches = result.updatedWorkflow.match(/({%[\s\S]*?%}|{{[\s\S]*?}})/g) || [];
    
    // Log template preservation stats
    console.log(`Template expressions in initial workflow: ${initialTemplateMatches.length}`);
    console.log(`Template expressions in updated workflow: ${updatedTemplateMatches.length}`);
    
    // If we lost template expressions, try to recover them or log a warning
    if (initialTemplateMatches.length > 0 && updatedTemplateMatches.length < initialTemplateMatches.length) {
      console.warn("Some template expressions may have been lost during workflow update!");
      console.warn("Original expressions:", initialTemplateMatches);
      console.warn("Updated expressions:", updatedTemplateMatches);
    }
    
    return result.updatedWorkflow;
    
  } catch (error) {
    console.error('Error updating workflow with AI:', error);
    return initialWorkflow; // Return original workflow if update fails
  }
}

// Main function to execute workflow
export const executeWorkflow = ({ session, dataStream }: ExecuteWorkflowProps) =>
  tool({
    description: TOOL_DESCRIPTION,
    parameters: z.object({
      userRequest: z.string().describe('The user\'s specific request for what they want to accomplish'),
      documentId: z.string().optional().describe('The ID of an existing workflow document to use as reference'),
      debug: z.boolean().optional().default(false).describe('Include detailed debug information in results')
    }),
    execute: async ({ userRequest, documentId, debug }) => {
      console.log(`Analyzing workflow for request: ${userRequest}`);
      
      try {
        // Step 1: Get the reference document (agent)
        let referenceDocument;
        
        if (documentId) {
          referenceDocument = await getDocumentById({ id: documentId });
          if (!referenceDocument) {
            return {
              success: false,
              error: `Reference document with ID ${documentId} not found`,
            };
          }
        } else {
          // Get most recent workflow document
          const recentDocs = await getRecentDocumentsByKind({
            userId: session.user.id,
            kind: 'code',
            limit: 1
          });
          
          if (recentDocs && recentDocs.length > 0) {
            referenceDocument = recentDocs[0];
          } else {
            return {
              success: false,
              error: 'No reference workflow document found. Please create a workflow document first.',
            };
          }
        }
        
        console.log(`Using reference document: ${referenceDocument.title} (${referenceDocument.id})`);
        
        // Step 2: Start the analysis process
        dataStream.writeData({
          type: 'analyzing',
          content: `Analyzing existing workflow to create a flow for: ${userRequest}`
        });
        
        // Step 3: Use AI to generate an initial workflow document
        const { fullStream } = await streamObject({
          model: myProvider.languageModel('artifact-model'),
          system: `You are an expert in creating ACT workflow configurations in the INI format. 
You need to analyze an existing workflow document and create a tailored workflow that accomplishes a specific user request.

CRITICAL FORMATTING RULES (MUST FOLLOW EXACTLY):
1. DO NOT use quotation marks ("") around ANY values - all values must be unquoted
2. DO NOT use JSON format ANYWHERE - flatten all parameters into individual key=value pairs
3. Every parameter must be in format "key = value" (with space around the equals sign)
4. Follow the exact same parameter structure as shown in examples below
5. Only use node types and operations that exist in the reference document - DO NOT invent new ones
6. Preserve all required parameters for each operation type from the reference

TEMPLATE SYNTAX HANDLING:
7. You may use template syntax ({% %} and {{ }}) for dynamic data
8. Template expressions like {% for item in collection %} ... {% endfor %} are used for loops
9. Variable references like {{ variable.path }} are used to access data from operation results
10. Make sure variable paths match the expected JSON structure from API operations`,
          
          prompt: `Reference workflow document content:
${referenceDocument.content}

USER REQUEST: ${userRequest}

Instructions:
1. Create an INITIAL workflow for: ${userRequest}
2. Start with just 1-2 nodes to get started - we'll add more nodes dynamically later
3. DO NOT use JSON format - use the INI sections with square brackets
4. Make sure to include all necessary node sections, each with "id = node_name" parameter
5. Include all required sections in correct order: [parameters], [workflow], [node:xxx], [edges], [settings], [env]
6. Every parameter should use "key = value" format, not JSON format
7. Only use node types and operations that exist in the reference document
8. You can use template syntax ({% %} and {{ }}) for dynamic data when appropriate`,
          schema: z.object({
            content: z.string(),
          }),
          maxTokens: 70000,
          temperature: 0
        });
        
        let lastValidContent = '';
        let finalContent = '';
        
        for await (const chunk of fullStream) {
          if (chunk.type === 'object' && chunk.object?.content) {
            lastValidContent = chunk.object.content;
            finalContent = lastValidContent;
            
            dataStream.writeData({
              type: 'flow-preview',
              content: lastValidContent,
            });
          }
        }
        
        if (!finalContent) {
          return {
            success: false,
            error: 'Failed to generate a valid flow from the existing workflow. Please check your request.',
          };
        }
        
        // Normalize and validate the workflow format
        console.log('Normalizing workflow format...');
        finalContent = normalizeWorkflowFormat(finalContent);
        console.log('Validating workflow nodes...');
        finalContent = validateWorkflowNodes(finalContent, referenceDocument.content);
        
        // Verify basic format - check if it has [workflow] section
        if (!finalContent.includes('[workflow]')) {
          return {
            success: false,
            error: 'Generated workflow has an invalid format. Missing [workflow] section.',
            document: {
              id: generateUUID(),
              title: `Invalid flow for: ${userRequest}`,
              content: finalContent
            }
          };
        }
        
        // Step 4: Save the generated flow
        const flowId = generateUUID();
        const flowTitle = `Dynamic Flow: ${userRequest.slice(0, 30)}${userRequest.length > 30 ? '...' : ''}`;
        
        await saveDocument({
          id: flowId,
          userId: session.user.id,
          title: flowTitle,
          content: finalContent,
          kind: 'code'
        });
        
        console.log(`Saved initial flow document with ID: ${flowId}`);
        
        // Step 5: Check if Docker service is ready
        const dockerHealthy = await dockerService.checkHealth();
        if (!dockerHealthy) {
          return {
            success: false,
            error: 'Docker service is unavailable. Unable to execute workflow.',
            document: {
              id: flowId,
              title: flowTitle,
              content: finalContent,
            },
            agentDocument: {
              id: referenceDocument.id,
              title: referenceDocument.title
            }
          };
        }
        
        // Step 6: Prepare for execution
        dataStream.writeData({
          type: 'executing',
          content: `Preparing for dynamic execution...`
        });
        
        // Start Docker container for execution
        try {
          console.log('Starting container for execution');
          await dockerService.startContainer(flowId);
          
          // Wait for container to be ready
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check container status
          const containerStatus = dockerService.getContainerStatus(flowId);
          console.log('Container status:', containerStatus);
          
          if (containerStatus.status !== 'running') {
            throw new Error('Container failed to start: ' + (containerStatus.lastError || 'Unknown error'));
          }
          
          if (!containerStatus.port) {
            throw new Error('Container started but no port was assigned');
          }
          
          // --------------- DYNAMIC EXECUTION BEGINS HERE ---------------
          
          // Parse the workflow to get nodes and edges
          const { nodes, edges } = parseWorkflowNodes(finalContent);
          
          dataStream.writeData({
            type: 'execution-setup',
            content: `Starting dynamic execution with ${nodes.length} initial nodes`
          });
          
          // Track execution results for all nodes
          const allExecutionResults = [];
          const allExecutedNodes = [];
          
          // Determine execution order using edges
          const executionOrder = [];
          let currentNodeId = null;
          
          // Find start node (node with no incoming edges)
          for (const node of nodes) {
            const nodeId = node.id;
            const hasIncomingEdge = Object.values(edges).includes(nodeId);
            
            if (!hasIncomingEdge) {
              executionOrder.push(nodeId);
              currentNodeId = nodeId;
              break;
            }
          }
          
          // If no start node found, use the first node
          if (!currentNodeId && nodes.length > 0) {
            currentNodeId = nodes[0].id;
            executionOrder.push(currentNodeId);
          }
          
          // Build the rest of the execution order using edges
          while (currentNodeId && edges[currentNodeId]) {
            currentNodeId = edges[currentNodeId];
            executionOrder.push(currentNodeId);
          }
          
          console.log(`Initial execution order: ${executionOrder.join(' -> ')}`);
          
          // Execute nodes dynamically with AI updates between each step
          let currentWorkflow = finalContent;
          
          for (let i = 0; i < executionOrder.length; i++) {
            const nodeId = executionOrder[i];
            
            dataStream.writeData({
              type: 'node-executing',
              content: `Executing node: ${nodeId} (${i+1} of ${executionOrder.length})`
            });
            
            // Execute single node - getting complete raw results
            const nodeResult = await dockerService.executeSingleNode(
              flowId,
              nodeId,
              currentWorkflow
            );
            
            console.log(`Node execution completed for ${nodeId}:`, JSON.stringify(nodeResult, null, 2));
            
            // Log template expressions for debugging
            const templateExpressions = (nodeResult.result && typeof nodeResult.result === 'string') 
              ? nodeResult.result.match(/({%[\s\S]*?%}|{{[\s\S]*?}})/g) 
              : [];
            
            if (templateExpressions && templateExpressions.length > 0) {
              console.log(`Found template expressions in result:`, templateExpressions);
            }
            
            // Add to results list
            allExecutionResults.push({
              nodeId,
              operation: nodeResult.operation || nodeId,
              status: nodeResult.status,
              message: nodeResult.error || '',
              rawResult: nodeResult.result || {},
              duration: nodeResult.duration || 0
            });
            
            // Add to executed nodes list for AI context - preserve complete raw result
            allExecutedNodes.push({
              nodeId,
              result: nodeResult.result, // Pass the complete raw result
              status: nodeResult.status,
              executedAt: new Date().toISOString()
            });
            
            dataStream.writeData({
              type: 'node-result',
              content: {
                nodeId,
                status: nodeResult.status,
                result: nodeResult.result || null
              }
            });
            
            // If this is not the last node, update the workflow with AI
            if (i < executionOrder.length - 1) {
              dataStream.writeData({
                type: 'workflow-updating',
                content: `Updating workflow based on ${nodeId} execution result`
              });
              
              // Update workflow using AI based on execution results
              // Pass the complete raw result directly - critical for template handling
              const updatedWorkflow = await updateWorkflowWithAI(
                currentWorkflow,
                nodeId,
                nodeResult.result,
                userRequest,
                allExecutedNodes,
                referenceDocument.content
              );
              
              // Only update if something changed
              if (updatedWorkflow !== currentWorkflow) {
                currentWorkflow = updatedWorkflow;
                
                // Save the updated workflow document
                await updateDocumentInPlace({
                  id: flowId,
                  content: currentWorkflow,
                });
                
                dataStream.writeData({
                  type: 'workflow-updated',
                  content: currentWorkflow
                });
                
                // Re-parse the workflow to get updated execution order
                const { nodes: updatedNodes, edges: updatedEdges } = parseWorkflowNodes(currentWorkflow);
                
                // Find nodes that weren't in the original execution order
                const newNodes = updatedNodes
                  .map(node => node.id)
                  .filter(id => !executionOrder.includes(id));
                
                // Add new nodes to execution order based on edges
                if (newNodes.length > 0) {
                  console.log(`Found ${newNodes.length} new nodes after updating workflow`);
                  
                  // Rebuild execution order from current position
                  // First, get the next node in current order
                  const nextPlannedNode = executionOrder[i + 1];
                  
                  // Start with executed nodes + current node
                  const newExecutionOrder = executionOrder.slice(0, i + 1);
                  
                  // Find new connections from the most recently executed node
                  let nextNodeId = updatedEdges[nodeId];
                  
                  // Add nodes until we reach the original next node or end of chain
                  while (nextNodeId && nextNodeId !== nextPlannedNode) {
                    newExecutionOrder.push(nextNodeId);
                    nextNodeId = updatedEdges[nextNodeId];
                  }
                  
                  // Add remaining nodes from original order
                  if (nextPlannedNode) {
let remainingNodesIndex = executionOrder.indexOf(nextPlannedNode);
                    newExecutionOrder.push(...executionOrder.slice(remainingNodesIndex));
                  }
                  
                  // Update execution order
                  executionOrder.splice(0, executionOrder.length, ...newExecutionOrder);
                  console.log(`Updated execution order: ${executionOrder.join(' -> ')}`);
                  
                  dataStream.writeData({
                    type: 'execution-order-updated',
                    content: `Execution plan updated with ${newNodes.length} new nodes`
                  });
                }
              }
            }
          }
          
          // --------------- DYNAMIC EXECUTION ENDS HERE ---------------
          
          // Process operation results from the execution output
          const operationResults = allExecutionResults;
          
          // Create a detailed summary with structured information about the execution
          const detailedSummary = createDetailedSummary(operationResults);
          
          // Attempt to stop the container
          try {
            await dockerService.stopContainer(flowId);
          } catch (stopError) {
            console.error('Error stopping container:', stopError);
          }
          
          dataStream.writeData({
            type: 'finish',
            content: `Dynamic flow execution completed`
          });
          
          // Return the complete execution result with enhanced summary
          return {
            success: operationResults.filter(r => r.status !== 'success').length === 0,
            document: {
              id: flowId,
              title: flowTitle,
              content: currentWorkflow, // Return the final updated workflow
            },
            agentDocument: {
              id: referenceDocument.id,
              title: referenceDocument.title
            },
            executionResult: {
              status: 'completed',
              timestamp: new Date().toISOString(),
              flowName: flowTitle,
              operationResults, // Include processed results
              summary: detailedSummary.summaryText, // Enhanced summary text
              importantLinks: detailedSummary.importantLinks, // Important links extracted from results
              errorDetails: detailedSummary.errorDetails, // Formatted error details
              executionOverview: {
                totalOperations: operationResults.length,
                successfulOperations: operationResults.filter(r => r.status === 'success').length,
                failedOperations: operationResults.filter(r => r.status !== 'success').length,
                dynamicUpdates: allExecutedNodes.length - 1, // Number of AI updates performed
              }
            }
          };
        } catch (executionError) {
          console.error('Execution error:', executionError);
          
          // Try to stop the container on error
          try {
            await dockerService.stopContainer(flowId);
          } catch (stopError) {
            console.error('Error stopping container after execution error:', stopError);
          }
          
          // Send error status to user
          dataStream.writeData({
            type: 'execution-error',
            content: executionError instanceof Error ? executionError.message : 'Unknown execution error'
          });
          
          return {
            success: false,
            error: executionError instanceof Error ? executionError.message : 'Unknown execution error',
            document: {
              id: flowId,
              title: flowTitle,
              content: finalContent,
            },
            agentDocument: {
              id: referenceDocument.id,
              title: referenceDocument.title
            }
          };
        }
        
      } catch (error) {
        console.error('Error executing workflow:', error);
        
        dataStream.writeData({
          type: 'finish',
          content: 'Error occurred during flow execution'
        });
        
        return {
          success: false,
          error: 'Failed to execute workflow flow',
          errorDetails: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
  });   