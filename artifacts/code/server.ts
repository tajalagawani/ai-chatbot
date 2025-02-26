import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/models';
import { createDocumentHandler } from '@/lib/artifacts/server';

// ACT Workflow Structure and Guidelines
const ACT_STRUCTURE_PROMPT = `
WORKFLOW ACT STRUCTURE
====================
1. Include at least 10 to 15 nodes or more IF needed to represent a comprehensive workflow based on the description.
2. Use various node shapes to represent different types of steps (e.g., rectangles for processes, diamonds for decisions).
3. Include detailed labels for each node and edge.
4. Represent complex logic with multiple paths and decision points.
5. Include any loops or repetitions in the process.
6. Add annotations or subgraphs if appropriate to group related steps.
7. Follow a clear and logical flow from start to finish.
8. When we need to use an API, specify the API name and the method to use.
9. Each node represents a specific operation or decision in the workflow.
10. Incorporate conditional statements (if/elif) for making decisions based on project type or AI recommendations.
11. Include loops (for) for iterating through recommended tools or document structures.
12. Implement error handling to manage exceptions and retry failed steps.

REQUIRED SECTIONS
-------------------
[workflow]
workflow_id = "\${EXISTING_ID}"    # Must preserve existing ID
name = "Workflow Name"            # Required workflow name
description = "Description"       # Required workflow description
start_node = "StartNodeID"        # Required: First node in execution chain

NODE DEFINITIONS
-----------------
[node:\${NODE_ID}]
type = "\${NODE_TYPE}"           # Required: Node type (e.g., "start", "process", "end")
label = "\${LABEL}"              # Required: Display label
position_x = \${X}               # Required: X position
position_y = \${Y}               # Required: Y position
operation = "\${OP}"             # Required: Operation to perform
app_name = "\${APP_NAME}"        # Required: Application name (e.g., "GitHub", "Slack")
operation_name = "\${OP_NAME}"   # Required: Operation name
params = \${PARAMS}              # Required: Operation parameters
mode = "UC"                      # Required: Mode (usually "UC")

Additional node parameters:
- api_key = "\${API_KEY}"        # Optional: API key if needed
- slack_token = "\${TOKEN}"      # Optional: Slack token if needed
- method = "\${METHOD}"          # Optional: HTTP method if needed
- formData = \${FORM_DATA}       # Optional: Form data if needed

EDGE CONNECTIONS
-----------------
[edges]
source_node = target_node

ENVIRONMENT VARIABLES
-------------------
[env]
VARIABLE_NAME = \${VALUE}

CRITICAL RULES
============
1. Data Integrity: Ensure all required fields are present and properly formatted
2. Node Types: Each node MUST have a 'type' field
3. App Names: Each node MUST have an 'app_name' field
4. Data Flow: Validate edge connections between nodes
5. Response Format: Follow exact INI format structure

NAMING CONVENTIONS
================
1. Node IDs: lowercase with underscores
2. Environment Variables: UPPERCASE with underscores
3. Parameters: camelCase for JSON keys
4. Node Types: lowercase (start, process, end, error, decision)
5. App Names: PascalCase (GitHub, Slack, OpenAI)`;

// Artifacts UI Guidelines
const ARTIFACTS_PROMPT = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side.

When asked to write ACT configuration files, always use artifacts. Use the exact format specified in the ACT file instructions.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.`;

// Combined system prompts
const SYSTEM_PROMPTS = {
  create: `${ACT_STRUCTURE_PROMPT}\n\n${ARTIFACTS_PROMPT}\n\nAdditional Create Guidelines:
1. Always generate complete, valid ACT configurations
2. Include comprehensive error handling
3. Follow naming conventions strictly
4. Position nodes logically
5. Ensure proper edge connections`,

  update: `${ACT_STRUCTURE_PROMPT}\n\n${ARTIFACTS_PROMPT}\n\nAdditional Update Guidelines:
1. Preserve existing workflow_id
2. Maintain structure integrity
3. Keep existing node connections valid
4. Update only necessary sections
5. Validate all changes`
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
    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1);
        if (currentSection.startsWith('node:')) {
          currentNodeId = currentSection.split(':')[1].trim();
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

      if (line.includes('=')) {
        const [key, value] = line.split('=').map(part => part.trim());
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        try {
          if (currentSection.startsWith('node:')) {
            sections.nodes[currentNodeId][trimmedKey] = this.parseValue(trimmedValue);
          } else if (currentSection === 'edges') {
            const sourceNode = trimmedKey;
            const targetNode = this.parseValue(trimmedValue);
            if (typeof targetNode === 'string' && sourceNode) {
              sections.edges.push({
                source: sourceNode,
                target: targetNode
              });
            }
          } else if (currentSection === 'workflow') {
            sections.workflow[trimmedKey] = this.parseValue(trimmedValue);
          } else if (currentSection === 'env') {
            sections.env[trimmedKey] = this.parseValue(trimmedValue);
          }
        } catch (error) {
          if (this.debug) {
            console.error(`Error parsing line: ${line}`, error);
          }
        }
      }
    }

    return sections;
  }

  private parseValue(value: string): any {
    value = value.trim();
    
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch {
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
      
      if (Object.keys(parsed.nodes).length === 0) {
        if (this.debug) console.error('Validation failed: No nodes defined');
        return false;
      }

      // Check for required node fields
      for (const [nodeId, node] of Object.entries(parsed.nodes)) {
        if (!node.type) {
          if (this.debug) console.error(`Validation failed: Node '${nodeId}' missing 'type' field`);
          return false;
        }
        if (!node.app_name) {
          if (this.debug) console.error(`Validation failed: Node '${nodeId}' missing 'app_name' field`);
          return false;
        }
      }

      if (!parsed.workflow.name || !parsed.workflow.description) {
        if (this.debug) console.error('Validation failed: Missing workflow name or description');
        return false;
      }

      if (!parsed.workflow.start_node) {
        parsed.workflow.start_node = Object.keys(parsed.nodes)[0];
      } else if (!parsed.nodes[parsed.workflow.start_node]) {
        if (this.debug) console.error('Validation failed: Invalid start node reference');
        return false;
      }

      const nodeIds = new Set(Object.keys(parsed.nodes));
      const validEdges = parsed.edges.filter(edge => {
        const isValid = nodeIds.has(edge.source) && nodeIds.has(edge.target);
        if (!isValid && this.debug) {
          console.error(`Invalid edge: ${edge.source} -> ${edge.target}`);
        }
        return isValid;
      });

      parsed.edges = validEdges;

      actWorkflowSchema.parse(parsed);
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
description = "Workflow for ${title}"
start_node = "start"

[node:start]
type = "start"
label = "Start Process"
position_x = 100
position_y = 100
operation = "start"
app_name = "System"
operation_name = "startWorkflow"
params = {"initialized": true}
mode = "UC"

[node:end]
type = "end"
label = "End Process"
position_x = 1200
position_y = 600
operation = "end"
app_name = "System"
operation_name = "endWorkflow"
params = {"cleanup": true}
mode = "UC"

[node:error_handler]
type = "error"
label = "Error Handler"
position_x = 800
position_y =400
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
        prompt: `Extend this base workflow configuration for: ${title}
                Requirements:
                1. Add all necessary workflow-specific nodes
                2. Ensure proper error handling connections
                3. Maintain valid edge connections
                4. Include relevant environment variables
                5. Position nodes logically
                
                Base configuration:
                ${baseContent}`,
        schema: z.object({
          content: z.string(),
        }),
        maxTokens: 4000,
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

  onUpdateDocument: async ({ document, description, dataStream }) => {
    try {
      const currentValidator = new ActValidator(document.content, true);
      
      if (!currentValidator.validate()) {
        console.error('Current document validation failed');
        return document.content;
      }

      const { fullStream } = await streamObject({
        model: myProvider.languageModel('artifact-model'),
        system: SYSTEM_PROMPTS.update,
        prompt: `Current configuration:\n${document.content}\n\nUpdate request: ${description}\n
                Requirements:
                1. Preserve existing workflow structure
                2. Maintain all valid edge connections
                3. Keep error handling intact
                4. Update only necessary sections
                5. Ensure all changes are valid`,
        schema: z.object({
          content: z.string(),
        }),
        maxTokens: 4000,
        temperature: 0.7
      });

      let updatedContent = document.content;
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

      return updatedContent;
    } catch (error) {
      console.error('Error in onUpdateDocument:', error);
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