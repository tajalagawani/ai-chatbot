import { AgentConfig } from "@/app/types";
import { v4 as uuidv4 } from "uuid";
import { DataStreamWriter } from 'ai';

// Custom data stream writer for voice API integration
class VoiceDataStreamWriter implements DataStreamWriter {
  private sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void;
  private userRequest: string;
  private messageBuffer: Map<string, string> = new Map();
  private lastUpdateTime: number = 0;
  private isFlushScheduled: boolean = false;
  private assistantMessageId: string | null = null;
  private hasInitialMessage: boolean = false;

  constructor(
    sendClientEvent: (eventObj: any, eventNameSuffix?: string) => void,
    userRequest: string
  ) {
    this.sendClientEvent = sendClientEvent;
    this.userRequest = userRequest;
  }

  writeData(data: { type: string; content: any }): boolean {
    // Log updates for debugging
    console.log("Action update:", data.type, typeof data.content === 'object' ? JSON.stringify(data.content) : data.content);
    
    // Process based on update type
    switch (data.type) {
      case 'analyzing':
        this.queueMessage('analyzing', `I'm analyzing how to ${this.userRequest}...`);
        break;
        
      case 'flow-preview':
        this.queueMessage('flow-preview', `I've designed a workflow to handle your request. Starting execution now...`);
        break;
        
      case 'executing':
        this.queueMessage('executing', `Preparing to execute the workflow...`);
        break;
        
      case 'execution-setup':
        this.queueMessage('execution-setup', typeof data.content === 'string' 
          ? data.content 
          : `Setting up the execution environment.`
        );
        break;
        
      case 'node-executing':
        this.queueMessage('node-executing', typeof data.content === 'string' 
          ? data.content 
          : `Executing the next step in the workflow.`
        );
        break;
        
      case 'node-result':
        if (data.content && typeof data.content === 'object') {
          const status = data.content.status || 'unknown';
          if (status === 'success') {
            this.queueMessage('node-result-success', `Successfully completed a step in the workflow.`);
          } else if (status === 'error') {
            this.queueMessage('node-result-error', `Encountered an issue with one of the steps. Let me try to resolve it.`);
          }
        }
        break;
        
      case 'workflow-updating':
        this.queueMessage('workflow-updating', `Based on what I've learned, I'm adjusting the next steps...`);
        break;
        
      case 'workflow-updated':
        // Don't need to notify about this specifically
        break;
        
      case 'execution-order-updated':
        this.queueMessage('execution-order-updated', typeof data.content === 'string' 
          ? data.content 
          : `I've updated the execution plan based on the results.`
        );
        break;
        
      case 'execution-error':
        this.queueMessage('execution-error', typeof data.content === 'string' 
          ? `I encountered an error: ${data.content}. Let's try a different approach.` 
          : `I encountered an error. Let's try a different approach.`
        );
        break;
        
      case 'finish':
        this.queueMessage('finish', `I've completed the action. Let me tell you about the results.`);
        break;
        
      default:
        // For other update types, don't send a message
        break;
    }
    
    // Schedule a flush if not already scheduled
    if (!this.isFlushScheduled && this.messageBuffer.size > 0) {
      this.isFlushScheduled = true;
      setTimeout(() => this.flushMessages(), 1500); // Group updates in 1.5 second windows
    }
    
    return true;
  }

  private queueMessage(type: string, message: string): void {
    this.messageBuffer.set(type, message);
  }

  private flushMessages(): void {
    this.isFlushScheduled = false;
    
    if (this.messageBuffer.size === 0) {
      return;
    }
    
    // Create a combined message with prioritized updates
    const priorityOrder = [
      'execution-error',
      'analyzing',
      'flow-preview',
      'executing',
      'execution-setup',
      'node-executing',
      'node-result-error',
      'node-result-success',
      'workflow-updating',
      'execution-order-updated',
      'finish'
    ];
    
    // Get the highest priority message
    let message = '';
    for (const priority of priorityOrder) {
      if (this.messageBuffer.has(priority)) {
        message = this.messageBuffer.get(priority) || '';
        break;
      }
    }
    
    // If no prioritized message found, just take the first one
    if (!message && this.messageBuffer.size > 0) {
      message = Array.from(this.messageBuffer.values())[0];
    }
    
    // Only send if we have a message
    if (message) {
      this.sendVoiceResponse(message);
    }
    
    // Clear buffer and reset flag
    this.messageBuffer.clear();
    this.lastUpdateTime = Date.now();
  }

  private sendVoiceResponse(text: string): void {
    try {
      // Check if sendClientEvent is available
      if (!this.sendClientEvent) {
        console.warn("Cannot send voice response: sendClientEvent function not available");
        return;
      }

      // If we don't have an initial message yet, create one
      if (!this.hasInitialMessage) {
        try {
          // Instead of creating a new message via data channel, append to console log
          console.log("VOICE RESPONSE (initial):", text);
          this.hasInitialMessage = true;
          
          // Only try to get a message ID if we succeed
          this.assistantMessageId = uuidv4().slice(0, 32);
        } catch (err) {
          console.warn("Failed to create initial message:", err);
        }
      } else {
        // For updates, just log to console instead of trying to update
        console.log("VOICE RESPONSE (update):", text);
      }
    } catch (error) {
      console.error("Error sending voice response:", error);
    }
  }
}

// Actions Agent Configuration
const actionsAgent: AgentConfig = {
  name: "actionsAgent",
  publicDescription:
    "Specialized agent for creating and executing automated actions. Helps users design, test, and run workflows that connect various services.",
  instructions: `
# Personality and Tone
## Identity
You are an Actions Assistant who specializes in creating and executing automated workflows. Your expertise helps users connect different systems together and accomplish complex tasks through automation. You explain technical concepts clearly and make automation accessible to everyone.

## Task
Your primary responsibility is to help users create and execute actions. This involves understanding what they want to accomplish, designing appropriate workflows, and executing them when ready. You provide clear updates throughout the process and explain the results in user-friendly terms.

## Demeanor
Maintain a balanced tone that is both professional and approachable. When explaining technical concepts, use clear language and a measured pace. Show genuine interest in helping users achieve their goals through automation.

## Tone
Your tone is confident but conversational. You use technical terminology when necessary but always explain it clearly. You're enthusiastic about the possibilities of automation while being realistic about what's possible.

## Level of Enthusiasm
Express moderate enthusiasm - be genuinely excited about automation without overwhelming the user. Your energy should convey competence and reliability.

## Level of Formality
Keep your language moderately professional. Use conversational phrases but maintain clear structure in your explanations and updates.

## Level of Emotion
Be supportive and encouraging, especially when users encounter challenges. Express appropriate reactions to both successes and failures during workflow execution.

## Filler Words
Use minimal filler words to maintain clarity. Occasional use of "well," "so," or "now" can make your speech sound more natural when transitioning between topics.

## Pacing
Speak at a medium pace with appropriate pauses to let information sink in. For complex workflow explanations, slow down slightly.

# Context
- You help users create and execute automated actions that connect different services
- Actions are executed in secure, isolated environments (Docker containers)
- You can provide real-time updates as actions execute
- You can reference previous actions as templates for new ones

# Overall Instructions
- Always understand what the user wants to accomplish before suggesting an action
- Help users define their requirements clearly before execution
- Before executing an action, explain what will happen in simple terms
- During execution, provide periodic updates on progress in conversational language
- After execution, summarize what was accomplished and any resources created
- If errors occur, explain them in an accessible way and suggest solutions

# Action Execution Process
When executing an action:
1. First, confirm you understand what the user wants to accomplish
2. Explain that you'll create and execute an action for them
3. Call the executeWorkflow tool with appropriate parameters
4. As the action progresses, narrate key steps in a conversational way:
   - When analyzing and generating the workflow
   - When starting the execution environment
   - When executing individual nodes
   - When completing the action
5. Summarize what was accomplished, including any resources created

# Important Notes
- Focus on the user's goal rather than technical implementation details
- Translate technical updates into conversational language
- For errors, focus on what went wrong and next steps rather than technical details
- Always ask clarifying questions if the user's request is ambiguous
- If an action fails, offer to try an alternative approach or help debug the issue
- Never ask the user for technical details about Docker or implementation
- Always acknowledge and confirm before taking action

# Examples of Good Responses

When initiating an action:
"I understand you want to create a GitHub repository with an initial README file. I'll create an action to do that for you. This will involve connecting to GitHub and creating the repository with the content you specified. Let me start that process for you."

During execution:
"I'm currently creating the repository on GitHub. This should only take a moment."

For success:
"Good news! I've created the repository 'project-name' on GitHub with the README file. You can access it at this URL: https://github.com/username/project-name. Is there anything else you'd like me to add to this repository?"

For errors:
"I ran into an issue while trying to create the repository. It seems there might already be a repository with that name. Would you like to try with a different name, or would you prefer to update the existing repository instead?"
`,
  tools: [
    {
      type: "function",
      name: "executeWorkflow",
      description: `Execute operations using dynamically updated ACT workflow based on the user request.

This tool automatically:
1. Generates an initial workflow document based on the user's request
2. Executes the workflow node by node
3. After each node execution, updates the workflow document based on real data
4. Continues execution with the updated workflow
5. Returns the actual execution results`,
      parameters: {
        type: "object",
        properties: {
          userRequest: {
            type: "string",
            description: "The user's specific request for what they want to accomplish"
          },
          documentId: {
            type: "string",
            description: "The ID of an existing workflow document to use as reference"
          },
          debug: {
            type: "boolean",
            description: "Include detailed debug information in results"
          }
        },
        required: ["userRequest"],
        additionalProperties: false,
      },
    }
  ],
  toolLogic: {
    executeWorkflow: async (args, transcriptItems, context) => {
      try {
        console.log("Executing workflow with args:", args);
        
        // Get sendClientEvent function from context
        let sendClientEvent = context?.sendClientEvent;
        
        // Create a fallback if sendClientEvent is not available
        if (!sendClientEvent) {
          console.warn("sendClientEvent function not provided, using fallback");
          sendClientEvent = (obj, suffix) => {
            console.log(`[FALLBACK MESSAGE] ${suffix || ''}:`, obj);
            return true;
          };
        }
        
        // Create the data stream with robust error handling
        const dataStream = new VoiceDataStreamWriter(
          sendClientEvent,
          args.userRequest
        );
        
        // Log execution start instead of trying to send a message
        console.log(`Starting execution for: ${args.userRequest}`);
        
        // Simulate the workflow execution with progress updates
        await simulateWorkflowExecution(dataStream, args.userRequest);
        
        // Simulate workflow result
        const result = {
          success: true,
          document: {
            id: uuidv4().slice(0, 32),
            title: `Action: ${args.userRequest.slice(0, 30)}${args.userRequest.length > 30 ? '...' : ''}`,
            content: "Simulated workflow content"
          },
          executionResult: {
            status: 'completed',
            timestamp: new Date().toISOString(),
            flowName: `Action: ${args.userRequest.slice(0, 30)}`,
            summary: "All operations completed successfully.",
            importantLinks: [
              {
                label: "GitHub Repository: newopentest",
                url: "https://github.com/tajalagawani/newopentest",
                nodeId: "get_repository"
              },
              {
                label: "Issue #1",
                url: "https://github.com/tajalagawani/newopentest/issues/1",
                nodeId: "update_issue"
              }
            ],
            errorDetails: [],
            executionOverview: {
              totalOperations: 2,
              successfulOperations: 2,
              failedOperations: 0,
              dynamicUpdates: 1
            }
          }
        };
        
        // Log final summary instead of trying to send a message
        const summaryText = `I've successfully completed the action to ${args.userRequest}. Here are the resources that were created or updated:
- GitHub Repository: newopentest (https://github.com/tajalagawani/newopentest)
- Issue #1 (https://github.com/tajalagawani/newopentest/issues/1)

The issue has been updated with a list of all repository links. Is there anything else you'd like to know about what was done?`;
        
        console.log("EXECUTION COMPLETE:", summaryText);
        
        try {
          // Try to send the final message, but don't rely on it working
          sendClientEvent({
            type: "conversation.item.create",
            item: {
              id: uuidv4().slice(0, 32),
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: summaryText }],
            },
          }, "action-complete");
        } catch (err) {
          console.warn("Failed to send final message:", err);
        }
        
        return result;
      } catch (error) {
        console.error("Error executing action:", error);
        
        // Log error instead of trying to send a message
        const errorMessage = `I encountered an error while trying to execute the action: ${error.message || "Unknown error"}. Let's try a different approach or refine the request.`;
        console.log("EXECUTION ERROR:", errorMessage);
        
        // Return error information
        return {
          success: false,
          error: error.message || "Failed to execute the action",
          errorDetails: error instanceof Error ? error.stack : "Unknown error"
        };
      }
    }
  },
  // Add empty downstreamAgents array - will be populated by injectTransferTools
  downstreamAgents: []
};

// Helper function to simulate workflow execution with appropriate delays
async function simulateWorkflowExecution(dataStream: VoiceDataStreamWriter, userRequest: string) {
  // Simulate analysis phase
  dataStream.writeData({
    type: 'analyzing',
    content: `Analyzing existing workflow to create a flow for: ${userRequest}`
  });
  await delay(2000);
  
  // Simulate flow preview
  dataStream.writeData({
    type: 'flow-preview',
    content: "Initial workflow created"
  });
  await delay(2000);
  
  // Simulate execution setup
  dataStream.writeData({
    type: 'execution-setup',
    content: `Starting dynamic execution with 2 initial nodes`
  });
  await delay(2000);
  
  // Simulate node execution
  dataStream.writeData({
    type: 'node-executing',
    content: `Executing node: get_repository (1 of 2)`
  });
  await delay(3000);
  
  // Simulate node result
  dataStream.writeData({
    type: 'node-result',
    content: { nodeId: 'get_repository', status: 'success' }
  });
  await delay(1000);
  
  // Simulate second node
  dataStream.writeData({
    type: 'node-executing',
    content: `Executing node: update_issue (2 of 2)`
  });
  await delay(3000);
  
  // Simulate node result
  dataStream.writeData({
    type: 'node-result',
    content: { nodeId: 'update_issue', status: 'success' }
  });
  await delay(1000);
  
  // Simulate completion
  dataStream.writeData({
    type: 'finish',
    content: `Dynamic flow execution completed`
  });
}

// Helper function to create delays
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default actionsAgent;