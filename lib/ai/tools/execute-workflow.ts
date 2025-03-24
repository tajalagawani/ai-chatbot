        // @/lib/ai/tools/execute-workflow.ts
        import { DataStreamWriter, tool } from 'ai';
        import { Session } from 'next-auth';
        import { z } from 'zod';
        import { getDocumentById, getRecentDocumentsByKind, saveDocument } from '@/lib/db/queries';
        import { generateUUID } from '@/lib/utils';
        import { streamObject } from 'ai';
        import { myProvider } from '@/lib/ai/models';
        import { dockerService } from '@/lib/services/docker';

        interface ExecuteWorkflowProps {
        session: Session;
        dataStream: DataStreamWriter;
        }

        // Tool description that explains how it works with ACT workflow files
        const TOOL_DESCRIPTION = `Execute operations using the ACT workflow document in the conversation context.

        This tool automatically:
        1. Uses the workflow document already in context (no need to provide ID)
        2. Analyzes the document to identify relevant operations for the user's request
        3. Creates and executes a workflow based on the request
        4. Returns the actual execution results`;

        // Function to normalize workflow format
        function normalizeWorkflowFormat(content: string): string {
        // Remove quotes around values
        let normalized = content.replace(/=\s*"([^"]*)"/g, '= $1');
        
        // Find node sections and extract JSON params to flatten them
        const nodeRegex = /\[node:(.*?)\]([\s\S]*?)(?=\[|$)/g;
        let match;
        
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
        
        return normalized;
        }

        // Function to validate workflow content against reference
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

        // Function to extract important information based on operation type
        function extractImportantResults(nodeId: string, operation: string, result: any): { 
        key: string; 
        value: string; 
        url?: string;
        important: boolean;
        } {
        try {
            switch (operation) {
            case 'create_repo':
                return {
                key: 'Repository URL',
                value: result.html_url || 'N/A',
                url: result.html_url,
                important: true
                };
            case 'create_issue':
                return {
                key: 'Issue URL',
                value: `#${result.number}: ${result.title}`,
                url: result.html_url,
                important: true
                };
            case 'create_file':
                return {
                key: 'File URL',
                value: result.content?.path || 'N/A',
                url: result.content?.html_url,
                important: true
                };
            case 'create_pull_request':
                return {
                key: 'Pull Request',
                value: `#${result.number}: ${result.title}`,
                url: result.html_url,
                important: true
                };
            case 'create_branch':
                return {
                key: 'Branch Name',
                value: result.name || 'N/A',
                url: result.commit?.url,
                important: true
                };
            case 'list_issues':
                return {
                key: 'Issues Count',
                value: Array.isArray(result) ? `${result.length} issues found` : 'N/A',
                important: false
                };
            default:
                // Generic extraction for other operations
                if (result.id) {
                return {
                    key: `${operation} ID`,
                    value: result.id,
                    important: false
                };
                } else if (result.url || result.html_url) {
                return {
                    key: `${operation} URL`,
                    value: result.url || result.html_url,
                    url: result.html_url || result.url,
                    important: true
                };
                } else {
                return {
                    key: `${operation} Result`,
                    value: 'Success',
                    important: false
                };
                }
            }
        } catch (error) {
            console.error(`Error extracting important results for ${operation}:`, error);
            return {
            key: `${operation} Result`,
            value: 'Success (details unavailable)',
            important: false
            };
        }
        }

        // Function to create detailed context-aware summaries
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
                const extractedInfo = extractImportantResults(
                result.nodeId, 
                result.operation, 
                result.rawResult
                );
                
                if (extractedInfo.url) {
                importantLinks.push({
                    label: `${extractedInfo.key}: ${extractedInfo.value}`,
                    url: extractedInfo.url,
                    nodeId: result.nodeId
                });
                }
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
                
                // Step 3: Use AI to generate a new workflow document
                const { fullStream } = await streamObject({
                model: myProvider.languageModel('artifact-model'),
                system: `You are an expert in creating ACT workflow configurations in the INI format. 
        You need to analyze an existing workflow document and create a tailored workflow that accomplishes a specific user request.

        CRITICAL FORMATTING RULES (MUST FOLLOW EXACTLY):
        1. DO NOT use quotation marks ("") around ANY values - all values must be unquoted
        2. DO NOT use JSON format ANYWHERE - flatten all parameters into individual key=value pairs
        4. Every parameter must be in format "key = value" (with space around the equals sign)
        5. Follow the exact same parameter structure as shown in examples below
        6. Only use node types and operations that exist in the reference document - DO NOT invent new ones
        7. Preserve all required parameters for each operation type from the reference

        Example of CORRECT GitHub node format:
        [node:create_issue]
        id = create_issue
        position_x = 100
        position_y = 100
        label = Create Issue
        type = github
        description = Creates an issue in the specified repository.
        operation = create_issue
        auth_type = token
        token  =  \${GITHUB_TOKEN}
        repo = backy
        owner = tajalagawani
        title = teest1
        body = text for test

        Example of INCORRECT format (DO NOT USE):
        [node:create_repository]
        id = create_repository
        position_x = 100
        position_y = 100
        label = "Create Repository"  # WRONG - has quotes
        type = "github"  # WRONG - has quotes
        description = "Create test repository"  # WRONG - has quotes
        operation = "create_repo"  # WRONG - has quotes
        params = {"auth_type": "token", "GITHUB_TOKEN": "\${GITHUB_TOKEN}"}  # WRONG - using JSON

        The workflow must include these sections in order: [parameters], [workflow], [node:xxx], [edges], [settings], [env]`,
                
                prompt: `Reference workflow document content:
        ${referenceDocument.content}

        Here's an example of the correct format for a simple workflow:
        [parameters]
        GITHUB_TOKEN = \${GITHUB_TOKEN}
        GITHUB_USERNAME = \${GITHUB_USERNAME}

        [workflow]
        name = Simple GitHub Operations
        description = Simplified GitHub workflow with core operations
        start_node = create_repository

        [node:create_repository]
        id = create_repository
        position_x = 100
        position_y = 100
        label = Create Repository
        type = github
        description = Create test repository
        operation = create_repo
        auth_type = token
        auth_type = token
        token  =  \${GITHUB_TOKEN}
        owner = tajalagawani
        name = simple-github-test-repo
        private = true
        auto_init = true

        [node:create_file]
        id = create_file
        position_x = 100
        position_y = 200
        label = Create File
        type = github
        description = Create a test file in repository
        operation = create_file
        auth_type = token
        auth_type = token
        token  =  \${GITHUB_TOKEN}
        owner = tajalagawani
        repo = simple-github-test-repo
        path = README.md
        message = Create README file
        content = # Simple GitHub Test\nThis is a test repository created by a simplified GitHub workflow.

        [node:create_issue]
        id = create_issue
        position_x = 100
        position_y = 300
        label = Create Issue
        type = github
        description = Create a test issue
        operation = create_issue
        auth_type = token
        auth_type = token
        token  =  \${GITHUB_TOKEN}
        owner = tajalagawani
        repo = simple-github-test-repo
        title = Test Issue
        body = This is a test issue created by the simplified GitHub workflow.

        [edges]
        create_repository = create_file
        create_file = create_issue

        [settings]
        debug = true
        timeout = 300
        retry_count = 3
        retry_delay = 5

        [env]
        ENVIRONMENT = test
        LOG_LEVEL = info

        IMPORTANT:
        1. DO NOT use quotation marks around values
        2. DO NOT use JSON format for parameters
        3. Include auth_type, GITHUB_TOKEN, and GITHUB_USERNAME as separate parameters for all GitHub operations
        4. Only use node types and operations that exist in the reference document
        5. Follow the exact parameter structure used in the reference document

        USER REQUEST: ${userRequest}

        Instructions:
        1. Using the exact same format as the reference document and example above, create a workflow for: ${userRequest}
        2. DO NOT use JSON format - use the INI sections with square brackets as shown in the example
        3. Make sure to include all necessary node sections, each with "id = node_name" parameter
        4. Include all required sections in correct order
        5. Every parameter should use "key = value" format, not JSON format
        6. Make sure to properly escape any special characters like quotes in strings
        7. Only use node types and operations that exist in the reference document`,
                schema: z.object({
                    content: z.string(),
                }),
                maxTokens: 20000,
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
                const flowTitle = `Flow: ${userRequest.slice(0, 30)}${userRequest.length > 30 ? '...' : ''}`;
                
                await saveDocument({
                id: flowId,
                userId: session.user.id,
                title: flowTitle,
                content: finalContent,
                kind: 'code'
                });
                
                console.log(`Saved flow document with ID: ${flowId}`);
                
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
                content: `Executing flow operations...`
                });
                
                // Start Docker container for execution
                try {
                console.log('Starting container for execution');
                await dockerService.startContainer(flowId);
                
                // Wait for container to be ready (longer wait time)
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
                
                // Execute the workflow
                console.log('Executing workflow in container');
                const executionResult = await dockerService.executeWorkflow(flowId, finalContent);
                
                if (!executionResult || executionResult.status !== 'queued') {
                    throw new Error('Failed to start workflow execution');
                }
                
                console.log('Execution queued with result:', executionResult);
                
                // Store the execution ID from the result
                const executionId = executionResult.executionId;
                if (!executionId) {
                    throw new Error('No execution ID returned from container');
                }
                
                dataStream.writeData({
                    type: 'status-update',
                    content: `Execution started with ID: ${executionId} on port ${containerStatus.port}`
                });
                
                // Poll for execution status
                let executionStatus = 'queued';
                let executionOutput = null;
                let executionLogs = [];
                let pollAttempts = 0;
                const maxPollAttempts = 30; // 30 seconds timeout
                
                // Match the polling approach in your code artifact component
                while (pollAttempts < maxPollAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    pollAttempts++;
                    
                    // Use our stored container port rather than re-fetching container status each time
                    try {
                    console.log(`Polling status from port ${containerStatus.port} for execution ${executionId}`);
                    
                    // Direct request to the container's status endpoint
                    const response = await fetch(
                        `http://localhost:${containerStatus.port}/status/${executionId}`,
                        { signal: AbortSignal.timeout(5000) }
                    );
                    
                    if (!response.ok) {
                        console.log(`Status check failed with HTTP ${response.status}`);
                        continue;
                    }
                    
                    // Parse the container's JSON response
                    const data = await response.json();
                    executionStatus = data.status;
                    console.log(`Execution status: ${executionStatus}`);
                    
                    // Stream real-time status updates
                    dataStream.writeData({
                        type: 'execution-status',
                        content: {
                        status: executionStatus,
                        message: data.message || '',
                        currentNode: data.currentNode || 'Unknown',
                        completedNodes: data.completedNodes || []
                        }
                    });
                    
                    // If the execution is complete, capture the result
                    if (data.result) {
                        executionOutput = data.result;
                        console.log('Got execution result:', JSON.stringify(executionOutput).substring(0, 200) + '...');
                        
                        // Stream results immediately
                        dataStream.writeData({
                        type: 'execution-results',
                        content: executionOutput
                        });
                    }
                    
                    // Fetch logs if available
                    try {
                        const logsResponse = await fetch(
                        `http://localhost:${containerStatus.port}/logs/${executionId}`
                        );
                        
                        if (logsResponse.ok) {
                        const logsData = await logsResponse.json();
                        if (logsData.logs) {
                            executionLogs = logsData.logs;
                            
                            // Stream logs if in debug mode
                            if (debug) {
                            dataStream.writeData({
                                type: 'execution-logs',
                                content: executionLogs
                            });
                            }
                        }
                        }
                    } catch (logsError) {
                        console.error('Error getting logs:', logsError);
                    }
                    
                    // Break the polling loop when execution is complete
                    if (executionStatus === 'completed' || executionStatus === 'failed') {
                        console.log(`Execution ${executionStatus} with result:`, executionOutput);
                        break;
                    }
                    } catch (error) {
                    console.error('Error checking execution status:', error);
                    
                    // Optional: Send error updates to client
                    dataStream.writeData({
                        type: 'status-error',
                        content: `Error checking status: ${error.message}`
                    });
                    }
                }
                
                // If we got to the end of polling without completion, create a mock result
                if (pollAttempts >= maxPollAttempts && executionStatus !== 'completed' && executionStatus !== 'failed') {
                    console.log('Execution timed out, creating mock result');
                    
                    // Instead of throwing an error, create a result with the timeout information
                    executionStatus = 'failed';
                    executionOutput = {
                    status: 'failed',
                    results: {},
                    error: 'Execution timed out after 30 seconds',
                    duration: 30000
                    };
                    
                    dataStream.writeData({
                    type: 'execution-error',
                    content: 'Execution timed out after 30 seconds'
                    });
                }
                
                // Process operation results from the execution output
                const operationResults = [];
                
                if (executionOutput && executionOutput.results) {
                    for (const [nodeId, result] of Object.entries(executionOutput.results)) {
                    operationResults.push({
                        nodeId,
                        operation: result.operation || nodeId,
                        status: result.status || 'unknown',
                        message: result.message || '',
                        rawResult: result.result || {},
                        duration: result.duration || 0,
                        startTime: result.startTime || null,
                        endTime: result.endTime || null
                    });
                    }
                }
                
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
                    content: `Flow execution ${executionStatus}`
                });
                
                // Return the complete execution result with enhanced summary
                return {
                    success: executionStatus === 'completed' && detailedSummary.errorDetails.length === 0,
                    document: {
                    id: flowId,
                    title: flowTitle,
                    content: finalContent,
                    },
                    agentDocument: {
                    id: referenceDocument.id,
                    title: referenceDocument.title
                    },
                    executionResult: {
                    status: executionStatus,
                    timestamp: new Date().toISOString(),
                    flowName: flowTitle,
                    rawOutput: executionOutput, // Include full raw output from container
                    operationResults, // Include processed results
                    logs: debug ? executionLogs : undefined,
                    summary: detailedSummary.summaryText, // Enhanced summary text
                    importantLinks: detailedSummary.importantLinks, // Important links extracted from results
                    errorDetails: detailedSummary.errorDetails, // Formatted error details
                    executionOverview: {
                        totalOperations: operationResults.length,
                        successfulOperations: operationResults.filter(r => r.status === 'success').length,
                        failedOperations: operationResults.filter(r => r.status !== 'success').length,
                        totalDuration: executionOutput?.duration || 0,
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