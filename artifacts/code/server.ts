import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/models';
import { createDocumentHandler } from '@/lib/artifacts/server';

// ACT Workflow Structure and Guidelines
const ACT_STRUCTURE_PROMPT = `
AUTONOMOUS AGENT SYSTEM STRUCTURE
====================
1. Include at least 10 to 15 agent nodes or more IF needed to represent a comprehensive autonomous system based on the description.
2. Use various node shapes to represent different types of autonomous agents (e.g., rectangles for processing agents, diamonds for decision-making agents).
3. Include highly detailed labels for each agent node. Each label must explain:
   - WHAT the agent does in specific terms
   - WHY this agent is necessary in the system
   - HOW the agent processes its inputs
   - WHAT outputs the agent produces
   - Any SPECIAL CONDITIONS the agent handles
4. Represent complex agent logic with multiple decision paths and autonomous reasoning points.
5. Include any feedback loops or iterative processing where agents may repeatedly perform tasks.
6. Add annotations or subgraphs if appropriate to group related autonomous agents.
7. Follow a clear and logical flow from initiating agent to completion agents.
8. When an agent needs to interact with an external API, specify the API name and the exact method to use.
9. Each agent node represents a specific autonomous operation or decision in the system.
10. Incorporate conditional reasoning agents (if/elif) for making autonomous decisions based on project type or AI recommendations.
11. Include iteration agents (for) for autonomously processing through recommended tools or document structures.
12. Implement error recovery agents to autonomously manage exceptions and retry failed operations.

REQUIRED SECTIONS
-------------------
[workflow]
workflow_id = "\${EXISTING_ID}"    # Must preserve existing ID
name = "Agent System Name"        # Required system name
description = "Description"       # Required system description
start_node = "StartNodeID"        # Required: First agent in execution chain


Reference Agent Types:
√SwitchNode - Autonomous routing agent that directs based on matching a value to different cases
BranchNode - Decision-making agent that routes execution along different paths based on conditions
MergeNode - Integration agent that combines outputs from multiple autonomous processing branches
SequenceNode - Orchestration agent that coordinates a series of operations in order
ParallelNode - Concurrent processing agent that executes multiple operations simultaneously
LoopNode - Repetition agent that continues execution until a condition is met
ForEachNode - Collection processing agent that applies an operation to each item in a collection
MapNode - Transformation agent that processes each element in a collection independently
FilterNode - Selection agent that identifies and extracts elements matching specific criteria
ReduceNode - Aggregation agent that combines values from a collection into a single result
TryCatchNode - Resilience agent that handles errors with fallback execution paths
RetryNode - Persistence agent that reattempts an operation with backoff strategies
ThrottleNode - Rate-limiting agent that controls execution frequency
DelayNode - Timing agent that introduces deliberate pauses in execution
TimeoutNode - Monitoring agent that enforces maximum execution times
QueueNode - Prioritization agent that manages execution order based on importance
DependencyNode - Coordination agent that executes based on prerequisites being satisfied
SemaphoreNode - Resource management agent that controls access to limited resources
ObserverNode - Monitoring agent that watches for changes and triggers responses
PublishSubscribeNode - Communication agent that implements pub/sub pattern for event distribution
AggregatorNode - Collection agent that combines multiple values into structured data
JoinNode - Synchronization agent that aligns multiple execution paths
SplitNode - Distribution agent that divides execution into multiple parallel paths
ValidatorNode - Quality assurance agent that verifies data meets required conditions
TransformerNode - Conversion agent that transforms data between formats
RouterNode - Intelligent routing agent that directs data based on complex rules
GatewayNode - Access control agent that governs passage of data based on conditions
ForkNode - Replication agent that creates multiple copies of the same execution path
SynchronizerNode - Timing coordination agent that ensures operations happen in sequence
StateNode - Context management agent that tracks and transitions between different states
RuleEngineNode - Policy enforcement agent that processes complex rule sets against data
DecisionTreeNode - Hierarchical reasoning agent that makes decisions based on structured conditions
PipelineNode - Process management agent that organizes operations into sequential stages
CompositeNode - Meta-agent that groups multiple specialized agents into a single logical unit
PriorityNode - Judgment agent that executes branches based on importance
InterruptNode - Control agent that halts execution based on specific conditions
ConditionalLoopNode - Adaptive iteration agent with custom entry and exit conditions
GroupByNode - Classification agent that organizes data into groups based on key attributes
SortNode - Ordering agent that arranges elements according to specified criteria
LimitNode - Constraint agent that restricts the number of items processed
BatchNode - Efficient processing agent that handles items in fixed-size groups
WindowNode - Time-aware agent that processes items in sliding time windows
DebounceNode - Efficiency agent that prevents duplicate processing within a time window
CorrelationNode - Pattern-matching agent that identifies related events or data
PredicateNode - Logical evaluation agent that assesses complex expressions
TokenBucketNode - Flow control agent that rate limits operations
CircuitBreakerNode - Protective agent that prevents operations when failure rate is high
AnyNode - Outcome agent that succeeds if any child agent succeeds
AllNode - Consensus agent that succeeds if all child agents succeed
CascadeNode - Fallback agent that attempts operations in sequence until one succeeds


AGENT NODE DEFINITIONS
-----------------
[node:\${NODE_ID}]
type = "\${NODE_TYPE}"           # Required: Agent type (e.g., "ValidatorNode", "LimitNode", "GroupByNode", "SlackNode", "GitHubNode")
label = "\${DETAILED_LABEL}"     # Required: Comprehensive explanation of the agent's purpose, inputs, processing logic, and outputs
position_x = \${X}               # Required: X position
position_y = \${Y}               # Required: Y position
operation = "\${OP}"             # Required: Operation the agent performs
app_name = "\${APP_NAME}"        # Required: Application name (e.g., "GitHub", "Slack") if API is used, otherwise "logic" for system agents
operation_name = "\${OP_NAME}"   # Required: Specific operation name
params = \${PARAMS}              # Required: Operation parameters and configuration
mode = "UC"                      # Required: Mode (usually "UC")

Additional agent parameters:
- api_key = "\${API_KEY}"        # Optional: API key if needed for external service access
- slack_token = "\${TOKEN}"      # Optional: Slack token if needed for communication
- method = "\${METHOD}"          # Optional: HTTP method if agent performs web requests
- formData = \${FORM_DATA}       # Optional: Form data if agent submits structured information

AGENT CONNECTIONS
-----------------
[edges]
source_agent = target_agent

ENVIRONMENT VARIABLES
-------------------
[env]
VARIABLE_NAME = \${VALUE}

CRITICAL RULES
============
1. Data Integrity: Ensure all required fields are present and properly formatted
2. Agent Types: Each agent node MUST have a 'type' 
3. App Names: Each agent node MUST have an 'app_name' field
4. Data Flow: Validate edge connections between autonomous agents
5. Response Format: Follow exact INI format structure
6. Label Detail: Every agent must have a detailed, comprehensive label explaining its purpose, function, and role

EDGES RULES
============
1.  Edge definitions MUST follow this exact format:
   [edges]
   actual_source_node_id = actual_target_node_id
2. NEVER use literal strings like "source_node" or "target_node"
   INCORRECT: source_node = target_node
   CORRECT: start = get_pr_details

3. All edge connections must reference actual agent node IDs defined in the system
4. Each edge must be on its own line under the [edges] section
5. Ensure all edge connections are valid and logical
NAMING CONVENTIONS
================
1. Node IDs: lowercase with underscores
2. Environment Variables: UPPERCASE with underscores
3. Parameters: camelCase for JSON keys
4. Node Types: lowercase (start, process, end, error, decision)
5. App Names: PascalCase (GitHub, Slack, OpenAI)

LAYOUT ALGORITHM REQUIREMENTS
============================
1. Position agent nodes in a logical flow-chart pattern from top to bottom and left to right
2. Each agent node has a size of 130x130 pixels
3. Start agent should be positioned at the top (lowest y value)
4. End agent should be positioned at the bottom (highest y value)
5. Maintain a minimum horizontal spacing of 250 pixels between agent node centers (220 pixels clear space)
6. Maintain a minimum vertical spacing of 200 pixels between agent node centers (270 pixels clear space)
7. Position agent nodes based on their logical sequence in the autonomous system
8. Decision agent nodes should have their conditional paths positioned appropriately:
   - "Yes" or "True" paths should flow downward or to the right
   - "No" or "False" paths should flow to a different direction
9. Group related agent nodes by positioning them in proximity to each other 200 pixels apart
10. Error handler agent nodes should be positioned at the bottom of the diagram
11. All coordinates must be positive integers
12. Sequential agent nodes should form clear paths without overlapping

`

;



// Artifacts UI Guidelines
const ARTIFACTS_PROMPT = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side.

When asked to write ACT configuration files, always use artifacts. Use the exact format specified in the ACT file instructions.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.`;

// Combined system prompts
const SYSTEM_PROMPTS = {
  create: `${ACT_STRUCTURE_PROMPT}\n\n${ARTIFACTS_PROMPT}\n\nAdditional Create Guidelines:
1. Always generate complete, valid autonomous agent configurations
2. Include comprehensive error recovery mechanisms
3. Follow naming conventions strictly
4. Position agent nodes logically
5. Ensure proper agent connections
6. Provide highly detailed labels for each agent that explain WHAT it does, WHY it's needed, and HOW it processes information`,

  update: `${ACT_STRUCTURE_PROMPT}\n\n${ARTIFACTS_PROMPT}\n\nAdditional Update Guidelines:
1. Preserve existing workflow_id
2. Maintain autonomous system integrity
3. Keep existing agent connections valid
4. Update only necessary agent configurations
5. Validate all changes
6. Enhance agent labels with detailed explanations of purpose and function`
};

// Schema definitions
const actWorkflowSchema = z.object({
  workflow: z.object({
    workflow_id: z.string().optional(),
    name: z.string(),
    description: z.string(),
    start_node: z.string()
  }),
  nodes: z.record(z.object({
    type: z.string(),              // Required node type
    label: z.string(),
    position_x: z.number(),
    position_y: z.number(),
    operation: z.string(),
    app_name: z.string(),          // Required app name
    operation_name: z.string(),
    params: z.record(z.any()),
    mode: z.string(),
    api_key: z.string().optional(),
    slack_token: z.string().optional(),
    method: z.string().optional(),
    formData: z.record(z.any()).optional()
  })),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string()
  })).default([]),
  env: z.record(z.string()).default({})
});

// ACT Validator Class
class ActValidator {
  private content: string;
  private debug: boolean;
  
  constructor(content: string, debug: boolean = false) {
    this.content = content;
    this.debug = debug;
  }

  parseContent() {
    const sections: Record<string, any> = {
      workflow: {
        name: '',
        description: '',
        start_node: ''
      },
      nodes: {},
      edges: [],
      env: {}
    };
    
    let currentSection = '';
    let currentNodeId = '';
    
    const lines = this.content.split('\n').map(line => line.trim());
    
    // Debug the content being parsed
    if (this.debug) {
      console.log('Content to parse:', this.content.substring(0, 200) + '...');
      console.log('Number of lines:', lines.length);
    }
    
    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue;

      // Debug each line processing
      if (this.debug) {
        console.log(`Processing line: "${line}"`);
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1);
        if (this.debug) {
          console.log(`Section changed to: "${currentSection}"`);
        }
        
        if (currentSection.startsWith('node:')) {
          currentNodeId = currentSection.split(':')[1].trim();
          if (this.debug) {
            console.log(`Node ID detected: "${currentNodeId}"`);
          }
          
          if (!sections.nodes[currentNodeId]) {
            sections.nodes[currentNodeId] = {
              id: currentNodeId,
              type: 'process',          // Default type
              app_name: 'System',       // Default app name
              label: currentNodeId,
              position_x: 0,
              position_y: 0,
              operation: '',
              operation_name: '',
              params: {},
              mode: 'UC'
            };
          }
        }
        continue;
      }

      // Only process lines with equals sign for key-value pairs
      if (line.includes('=')) {
        const equalsIndex = line.indexOf('=');
        const key = line.substring(0, equalsIndex).trim();
        const value = line.substring(equalsIndex + 1).trim();
        
        if (this.debug) {
          console.log(`Key-value pair: "${key}" = "${value}"`);
        }

        try {
          if (currentSection.startsWith('node:')) {
            sections.nodes[currentNodeId][key] = this.parseValue(value);
          } else if (currentSection === 'edges') {
            const sourceNode = key;
            const targetNode = this.parseValue(value);
            if (typeof targetNode === 'string' && sourceNode) {
              sections.edges.push({
                source: sourceNode,
                target: targetNode
              });
            }
          } else if (currentSection === 'workflow') {
            sections.workflow[key] = this.parseValue(value);
            if (this.debug) {
              console.log(`Added to workflow: ${key} = ${this.parseValue(value)}`);
            }
          } else if (currentSection === 'env') {
            sections.env[key] = this.parseValue(value);
          }
        } catch (error) {
          if (this.debug) {
            console.error(`Error parsing line: ${line}`, error);
          }
        }
      }
    }

    // Debug final parsed structure
    if (this.debug) {
      console.log('Final parsed workflow section:', JSON.stringify(sections.workflow, null, 2));
    }

    return sections;
  }

  private parseValue(value: string): any {
    value = value.trim();
    
    // Debug value parsing
    if (this.debug) {
      console.log(`Parsing value: "${value}"`);
    }
    
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch (error) {
        if (this.debug) {
          console.error(`JSON parse error for: ${value}`, error);
        }
        return value;
      }
    }
    
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value);
    }
    
    return value.replace(/['"]/g, '');
  }

  validate(): boolean {
    try {
      const parsed = this.parseContent();
      
      // Debug validation
      if (this.debug) {
        console.log('Validating parsed content:', 
          `Nodes: ${Object.keys(parsed.nodes).length}`,
          `Workflow: ${JSON.stringify(parsed.workflow)}`,
          `Edges: ${parsed.edges.length}`
        );
      }
      
      // Accept a minimum valid ACT file - less strict validation
      // This helps when loading existing content that might be partial
      if (parsed.workflow) {
        // If missing name/description but has other valid parts, still consider it valid
        if (!parsed.workflow.name) {
          parsed.workflow.name = "Untitled Workflow";
          if (this.debug) console.log('Warning: Setting default workflow name');
        }
        
        if (!parsed.workflow.description) {
          parsed.workflow.description = "No description provided";
          if (this.debug) console.log('Warning: Setting default workflow description');
        }
      }
      
      // Check nodes only if there are any
      if (Object.keys(parsed.nodes).length > 0) {
        // Validate each node has minimum required fields
        for (const [nodeId, node] of Object.entries(parsed.nodes)) {
          if (!node.type) {
            if (this.debug) console.error(`Validation failed: Node '${nodeId}' missing 'type' field`);
            node.type = 'process'; // Set default type
          }
          if (!node.app_name) {
            if (this.debug) console.error(`Validation failed: Node '${nodeId}' missing 'app_name' field`);
            node.app_name = 'System'; // Set default app
          }
        }

        // Set default start node if missing
        if (!parsed.workflow.start_node) {
          parsed.workflow.start_node = Object.keys(parsed.nodes)[0];
          if (this.debug) console.log(`Setting default start_node: ${parsed.workflow.start_node}`);
        } else if (!parsed.nodes[parsed.workflow.start_node]) {
          // If start node reference is invalid, use first node
          if (this.debug) console.error('Invalid start node reference, using first node');
          parsed.workflow.start_node = Object.keys(parsed.nodes)[0];
        }

        // Filter valid edges
        const nodeIds = new Set(Object.keys(parsed.nodes));
        const validEdges = parsed.edges.filter(edge => {
          const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
          if (!isValid && this.debug) {
            console.error(`Invalid edge: ${edge.source} -> ${edge.target}`);
          }
          return isValid;
        });

        parsed.edges = validEdges;
      }

      return true;
    } catch (error) {
      if (this.debug) {
        console.error('Validation failed:', error);
      }
      return false;
    }
  }

  getContent(): string {
    const sections = this.parseContent();
    let output = '';

    // Debug generated content
    if (this.debug) {
      console.log('Generating content from:', 
        `Nodes: ${Object.keys(sections.nodes).length}`,
        `Workflow: ${JSON.stringify(sections.workflow)}`
      );
    }

    output += '[workflow]\n';
    for (const [key, value] of Object.entries(sections.workflow)) {
      if (value !== undefined && value !== '') {
        output += `${key} = ${typeof value === 'string' ? `"${value}"` : value}\n`;
      }
    }
    output += '\n';

    for (const [nodeId, node] of Object.entries(sections.nodes)) {
      output += `[node:${nodeId}]\n`;
      for (const [key, value] of Object.entries(node)) {
        if (key !== 'id' && value !== undefined && value !== '') {
          output += `${key} = ${
            typeof value === 'object' ? JSON.stringify(value) : 
            typeof value === 'string' ? `"${value}"` : value
          }\n`;
        }
      }
      output += '\n';
    }

    const nodeIds = new Set(Object.keys(sections.nodes));
    const validEdges = sections.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    if (validEdges.length > 0) {
      output += '[edges]\n';
      for (const edge of validEdges) {
        output += `${edge.source} = ${edge.target}\n`;
      }
      output += '\n';
    }

    if (Object.keys(sections.env).length > 0) {
      output += '[env]\n';
      for (const [key, value] of Object.entries(sections.env)) {
        if (value !== undefined && value !== '') {
          output += `${key} = "${value}"\n`;
        }
      }
    }

    return output;
  }
}

// Base template generation
function generateBaseTemplate(title: string): string {
  return `[workflow]
name = "${title}"
description = "Autonomous Agent System for ${title}"
start_node = "start"

[node:start]
type = "start"
label = "Initiating Agent: Begins the process by setting up necessary context and preparing the system for execution. This agent validates initial parameters and constructs the execution environment before dispatching control to subsequent agents."
position_x = 100
position_y = 100
operation = "start"
app_name = "System"
operation_name = "startWorkflow"
params = {"initialized": true}
mode = "UC"

[node:end]
type = "end"
label = "Termination Agent: Finalizes all processing, ensures all resources are properly closed, and reports completion status. This agent verifies that all necessary actions have been completed successfully before concluding the workflow execution."
position_x = 1200
position_y = 600
operation = "end"
app_name = "System"
operation_name = "endWorkflow"
params = {"cleanup": true}
mode = "UC"

[node:error_handler]
type = "error"
label = "Recovery Agent: Captures and processes exceptions throughout the system, determines appropriate recovery strategies, logs detailed error information, and attempts remediation where possible. This agent ensures system resilience by providing intelligent error management."
position_x = 800
position_y = 400
operation = "error"
app_name = "System"
operation_name = "handleError"
params = {"retryCount": 3, "logLevel": "error"}
mode = "UC"

[edges]
start = end
start = error_handler
error_handler = end

[env]
ENVIRONMENT = "development"
ERROR_NOTIFICATION_CHANNEL = "errors"`;
}

// Document handler implementation
export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  systemPrompts: SYSTEM_PROMPTS,
  
  onCreateDocument: async ({ title, dataStream }) => {
    try {
      const baseContent = generateBaseTemplate(title);
      const baseValidator = new ActValidator(baseContent, true);
      
      if (!baseValidator.validate()) {
        throw new Error('Base template validation failed');
      }

      dataStream.writeData({
        type: 'code-delta',
        content: baseContent,
      });

      const { fullStream } = await streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: SYSTEM_PROMPTS.create,
        prompt: `Extend this base autonomous agent system configuration for: ${title}
                Requirements:
                1. Add all necessary specialized agent nodes with HIGHLY DETAILED labels explaining:
                   - WHAT each agent does in specific terms
                   - WHY this agent is necessary in the system
                   - HOW the agent processes its inputs
                   - WHAT outputs the agent produces
                   - Any SPECIAL CONDITIONS the agent handles
                2. Ensure proper error recovery connections
                3. Maintain valid agent connections
                4. Include relevant environment variables
                5. Position agent nodes logically
                
                Base configuration:
                ${baseContent}`,
        schema: z.object({
          content: z.string(),
        }),
        maxTokens: 20000,
        temperature: 0.1
      });

      let finalContent = baseContent;
      let lastValidContent = baseContent;

      for await (const chunk of fullStream) {
        if (chunk.type === 'object' && chunk.object?.content) {
          const validator = new ActValidator(chunk.object.content, true);
          
          if (validator.validate()) {
            lastValidContent = chunk.object.content;
            finalContent = lastValidContent;
            
            dataStream.writeData({
              type: 'code-delta',
              content: lastValidContent,
            });
          }
        }
      }

      return finalContent;
    } catch (error) {
      console.error('Error in onCreateDocument:', error);
      throw error;
    }
  },
// Fix for the onUpdateDocument function
// The current function can return null, but the type expects a string

// Fix for the onUpdateDocument function
onUpdateDocument: async ({ document, description, dataStream }) => {
  try {
    const currentValidator = new ActValidator(document.content, true);
    
    if (!currentValidator.validate()) {
      console.error('Current document validation failed');
      // Return original content instead of potentially null
      return document.content;
    }

    // Always assume we're working with existing document content
    let updatedContent = document.content;

    try {
      // First, set the document as updating to avoid race conditions
      dataStream.writeData({
        type: 'code-delta',
        content: document.content,
      });

      const { fullStream } = await streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: SYSTEM_PROMPTS.update,
        prompt: `Current autonomous agent system configuration:\n${document.content}\n\nUpdate request: ${description}\n
                Requirements:
                1. Preserve existing agent system structure
                2. Maintain all valid agent connections
                3. Keep error recovery mechanisms intact
                4. Update only necessary agent configurations
                5. Ensure all changes are valid
                6. Enhance agent labels with comprehensive details about:
                   - WHAT each agent does
                   - WHY the agent is necessary
                   - HOW the agent processes information
                   - WHAT outputs or decisions the agent produces
                   - Any SPECIAL CONDITIONS or SCENARIOS the agent handles`,
        schema: z.object({
          content: z.string(),
        }),
        maxTokens: 80000,
        temperature: 0
      });

      let lastValidContent = document.content;

      for await (const chunk of fullStream) {
        if (chunk.type === 'object' && chunk.object?.content) {
          const validator = new ActValidator(chunk.object.content, true);
          
          if (validator.validate()) {
            lastValidContent = chunk.object.content;
            updatedContent = lastValidContent;
            
            dataStream.writeData({
              type: 'code-delta',
              content: lastValidContent,
            });
          }
        }
      }

      // Ensure we complete the operation by writing final data and signaling completion
      dataStream.writeData({
        type: 'code-delta',
        content: updatedContent,
      });
      
      // Signal that the update is complete - this is crucial to properly close the tool invocation
      dataStream.writeData({ 
        type: 'finish', 
        content: '' 
      });

      // Return the updated content (or original if no valid updates occurred)
      return updatedContent;
    } catch (error) {
      console.error('Error during AI processing:', error);
      
      // Signal completion even when an error occurs
      dataStream.writeData({ 
        type: 'finish', 
        content: 'Error occurred during update' 
      });
      
      // Return original content on error
      return document.content; 
    }
  } catch (error) {
    console.error('Error in onUpdateDocument:', error);
    
    // Signal completion in the outer catch block too
    dataStream.writeData({ 
      type: 'finish', 
      content: 'Error occurred in document handler' 
    });
    
    // Always return a string, never null
    return document.content;
  }
},

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'code-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible: draftArtifact.status === 'streaming' && 
          draftArtifact.content.length > 300 && 
          draftArtifact.content.length < 310
            ? true 
            : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },
});

// Inject custom styles for ACT syntax highlighting
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .cm-section-header {
      color: #569cd6;
      font-weight: bold;
    }

    .cm-key {
      color: #9cdcfe;
    }

    .cm-value {
      color: #ce9178;
    }

    .cm-node-type {
      color: #4ec9b0;
    }

    .cm-comment {
      color: #6a9955;
      font-style: italic;
    }

    .react-flow__node {
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      color: #333;
      text-align: center;
      border-width: 2px;
      width: 150px;
    }

    .react-flow__node.running {
      border-color: #3b82f6;
      background-color: #eff6ff;
    }

    .react-flow__node.completed {
      border-color: #22c55e;
      background-color: #f0fdf4;
    }

    .react-flow__node.failed {
      border-color: #ef4444;
      background-color: #fef2f2;
    }

    .react-flow__edge-path {
      stroke-width: 2;
    }

    .react-flow__edge.animated path {
      stroke-dasharray: 5;
      animation: dashdraw 0.5s linear infinite;
    }

    @keyframes dashdraw {
      from {
        stroke-dashoffset: 10;
      }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default codeDocumentHandler;