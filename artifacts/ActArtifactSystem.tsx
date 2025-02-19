// ======================================================
// Module: ActArtifactSystem.ts
// ======================================================

import { ArtifactKind } from '@/components/artifact';

/* ============================================================================
 * Interfaces & Types
 * ========================================================================== */
interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export type ExtendedArtifactKind = ArtifactKind | 'act';

/* ============================================================================
 * Prompts & Constants
 * ========================================================================== */
export const REGULAR_PROMPT =
  'You are a friendly assistant! Keep your responses concise and helpful.';

export const ACT_BASE_PROMPT = `
You are an ACT workflow file generator. When creating ACT files:

 WORKFLOW INI STRUCTURE
    ====================
    1. Include at least 5 to 10 nodes or more IF needed to represent a comprehensive workflow based on the description.
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
    13. use the APP NAME type for all nodes. and the other info in the label
    REQUIRED SECTIONS
    -------------------
    [workflow]
    workflow_id = "\${EXISTING_ID}"    # Must preserve existing ID
    name = "Workflow Name"            # Optional workflow name
    description = "Description"       # Optional workflow description
    start_node = "StartNodeID"        # Required: First node in execution chain

    NODE DEFINITIONS
    -----------------
    [node:\${NODE_ID}]
    label = "\${APP_NAME}"
    position_x = \${X}
    position_y = \${Y}
    operation = "\${OP}"
    node_type = APP NAME
    operation_name = "\${OP_NAME}"
    params = \${PARAMS}
    mode = "UC"

    Additional node parameters:
    - api_key = "\${API_KEY}"
    - slack_token = "\${TOKEN}"
    - method = "\${METHOD}"
    - formData = \${FORM_DATA}

    EDGE CONNECTIONS
    -----------------
    [edges]
    source_node = target_node

    ENVIRONMENT VARIABLES
    -------------------
    [env]
    VARIABLE_NAME = \${VALUE}

    EXAMPLE WORKFLOW
    ================
    [workflow]
    name = "Condensed Test Workflow"
    description = "A short workflow to test all node types"
    start_node = chatmodels_test

    [node:chatmodels_test]
    api_key = \${OPENAI_API_KEY}
    input_text = "Generate 3 random facts about space"
    params = {"model": "gpt-40", "input_text": "Test message"}
    mode = "UC"
    node_type = APP NAME

    [node:aggregate_test]
    formData = {"aggregate": "All Item Data (Into a Single List)", "putOutputInField": "spaceFacts", "include": "All Fields"}
    items = {"content": "{{chatmodels_test.result.response}}"}
    mode = "UC"
    node_type = APP NAME

    [node:slack_test]
    label = "\${LABEL}"
    mode = "UC"
    type = "APP NAME"
    slack_token = \${SLACK_TOKEN}
    method = chat_postMessage
    params = {"channel": "C07T2FRDR9N", "text": "Space Facts: {{chatmodels_test.result.response}}"}

    [env]
    OPENAI_API_KEY = \${OPENAI_API_KEY}
    SLACK_TOKEN = \${SLACK_TOKEN}

    [edges]
    chatmodels_test = aggregate_test
    aggregate_test = slack_test
    force always APP NAME for the type for all the nodes 
    WORKFLOW ANALYSIS CAPABILITIES
    ===========================
    I can answer questions about:
    1. Node Configurations
    2. Flow Analysis
    3. Configuration Validation
    4. Best Practices

    CRITICAL RULES
    ============
    1. Data Integrity
    2. Node Configuration
    3. Data Flow
    4. Response Format

    NAMING CONVENTIONS
    ================
    1. Node IDs: lowercase with underscores
    2. Environment Variables: UPPERCASE with underscores
    3. Parameters: camelCase for JSON keys

    If someone asks about your name and model, you can say: I am Act, using the act03 model and I am still in development phase.

    Current workflow state will be provided. For questions, analyze the workflow and provide clear, detailed answers.
`;

export const ARTIFACTS_BASE_PROMPT = `
Artifacts is a special user interface mode that helps users with writing, editing, and other content creation tasks. When artifact is open, it is on the right side of the screen, while the conversation is on the left side. When creating or updating documents, changes are reflected in real-time on the artifacts and visible to the user.

When asked to write code, always use artifacts. When writing code, specify the language in the backticks, e.g. \`\`\`python\`code here\`\`\`. The default language is Python. Other languages are not yet supported, so let the user know if they request a different language.

DO NOT UPDATE DOCUMENTS IMMEDIATELY AFTER CREATING THEM. WAIT FOR USER FEEDBACK OR REQUEST TO UPDATE IT.

This is a guide for using artifacts tools: \`createDocument\` and \`updateDocument\`, which render content on a artifacts beside the conversation.

**When to use \`createDocument\`:**
- For substantial content (>10 lines) or code
- For content users will likely save/reuse (emails, code, essays, etc.)
- When explicitly requested to create a document
- For when content contains a single code snippet

**When NOT to use \`createDocument\`:**
- For informational/explanatory content
- For conversational responses
- When asked to keep it in chat

**Using \`updateDocument\`:**
- Default to full document rewrites for major changes
- Use targeted updates only for specific, isolated changes
- Follow user instructions for which parts to modify

**When NOT to use \`updateDocument\`:**
- Immediately after creating a document

**Special handling for ACT files:**
- Always create ACT files in artifacts
- Use .act extension
- Follow strict ACT file format
- Include all required sections
- Validate node connections
- Use environment variables for sensitive data
`;

/* ============================================================================
 * Prompt Generators
 * ========================================================================== */
export const systemPrompt = ({
  selectedChatModel,
}: {
  selectedChatModel: string;
}): string =>
  selectedChatModel === 'chat-model-reasoning'
    ? REGULAR_PROMPT
    : `${REGULAR_PROMPT}\n\n${ARTIFACTS_BASE_PROMPT}\n\n${ACT_BASE_PROMPT}`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ExtendedArtifactKind,
): string => {
  switch (type) {
    case 'act':
      return `Improve the following ACT workflow file based on the given prompt.
Maintain existing structure and node connections unless specifically requested to change.
Preserve environment variable references.

${currentContent}`;
    case 'text':
      return `Improve the following contents of the document based on the given prompt.

${currentContent}`;
    case 'code':
      return `Improve the following code snippet based on the given prompt.

${currentContent}`;
    case 'sheet':
      return `Improve the following spreadsheet based on the given prompt.

${currentContent}`;
    default:
      return '';
  }
};

/* ============================================================================
 * ACT File Validation Utilities
 * ========================================================================== */
export const validateActFile = (
  content: string,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  try {
    // Check for required sections
    if (!content.includes('[workflow]')) {
      errors.push('Missing [workflow] section');
    }
    if (!content.includes('[node:')) {
      errors.push('Missing node sections');
    }
    if (!content.includes('[edges]')) {
      errors.push('Missing [edges] section');
    }

    // Validate workflow section
    const workflowSection = content.match(/\[workflow\]([\s\S]*?)(?=\[|$)/);
    if (workflowSection) {
      const workflowContent = workflowSection[1];
      if (!workflowContent.includes('name =')) {
        errors.push('Workflow section missing name');
      }
      if (!workflowContent.includes('description =')) {
        errors.push('Workflow section missing description');
      }
    }

    // Validate node sections
    const nodeSections =
      content.match(/\[node:(.*?)\]([\s\S]*?)(?=\[|$)/g) || [];
    nodeSections.forEach((section) => {
      if (!section.includes('type =')) errors.push('Node missing type');
      if (!section.includes('label =')) errors.push('Node missing label');
      if (!section.includes('operation ='))
        errors.push('Node missing operation');
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Invalid ACT file format'],
    };
  }
};

export const extractNodeNames = (content: string): string[] => {
  const nodePattern = /\[node:(.*?)\]/g;
  const matches = [...content.matchAll(nodePattern)];
  return matches.map((match) => match[1]);
};

export const validateNodeConnections = (
  content: string,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const nodes = extractNodeNames(content);

  try {
    const edgesSection = content.split('[edges]')[1];
    if (!edgesSection) {
      return { valid: false, errors: ['Missing edges section'] };
    }

    const edges = edgesSection
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => {
        const [from, to] = line
          .split('=')
          .map((s) => s.trim().replace(/"/g, ''));
        return { from, to };
      });

    edges.forEach((edge) => {
      if (!nodes.includes(edge.from.toLowerCase())) {
        errors.push(`Invalid edge: source node "${edge.from}" not found`);
      }
      if (!nodes.includes(edge.to.toLowerCase())) {
        errors.push(`Invalid edge: target node "${edge.to}" not found`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Invalid edges format'],
    };
  }
};

/* ============================================================================
 * ACT Document Helper & Generator
 * ========================================================================== */
export const createActDocument = (content: string) => {
  const fileValidation = validateActFile(content);
  const connectionsValidation = validateNodeConnections(content);

  return {
    type: 'act' as ExtendedArtifactKind,
    content,
    isValid: fileValidation.valid && connectionsValidation.valid,
    errors: [...fileValidation.errors, ...connectionsValidation.errors],
  };
};

// Example: Generate a sample GitHub PR Review ACT file
export const generatePRReviewActFile = (): string => {
  return `
[workflow]
workflow_id = "github_pr_review_001"
name = "GitHub PR Review Workflow"
description = "A comprehensive workflow for reviewing GitHub Pull Requests"
start_node = "create_pr"

[node:create_pr]
label = "Create Pull Request"
position_x = 100
position_y = 200
operation = "createPullRequest"
node_type = APP NAME
operation_name = "Create PR"
params = {"description": "Developer creates a PR with proposed changes and context"}
mode = "UC"

[node:assign_reviewers]
label = "Assign Reviewers"
position_x = 300
position_y = 200
operation = "assignReviewers"
node_type = APP NAME
operation_name = "Assign Reviewers"
params = {"reviewers": "List of designated code reviewers"}
mode = "UC"

[node:review_code]
label = "Review Code"
position_x = 500
position_y = 200
operation = "reviewCode"
node_type = APP NAME
operation_name = "Code Review"
params = {"criteria": "Check for bugs, code style, and adherence to guidelines"}
mode = "UC"

[node:address_feedback]
label = "Address Feedback"
position_x = 700
position_y = 200
operation = "addressFeedback"
node_type = APP NAME
operation_name = "Resolve Feedback"
params = {"action": "Developer addresses review comments and makes necessary changes"}
mode = "UC"

[node:re_review]
label = "Re-review PR"
position_x = 900
position_y = 200
operation = "reReviewPR"
node_type = APP NAME
operation_name = "Re-review after changes"
params = {"check": "Ensure all feedback has been resolved"}
mode = "UC"

[node:approval]
label = "Approval"
position_x = 1100
position_y = 200
operation = "approvePR"
node_type = APP NAME
operation_name = "Approve PR"
params = {"approval": "Reviewer gives final approval"}
mode = "UC"

[node:merge_pr]
label = "Merge PR"
position_x = 1300
position_y = 200
operation = "mergePR"
node_type = APP NAME
operation_name = "Merge Pull Request"
params = {"merge": "Merge the PR into the main branch"}
mode = "UC"

[node:close_pr]
label = "Close PR"
position_x = 1500
position_y = 200
operation = "closePR"
node_type = APP NAME
operation_name = "Close PR"
params = {"action": "Close the PR post-merge"}
mode = "UC"

[node:post_merge_actions]
label = "Post Merge Actions"
position_x = 1700
position_y = 200
operation = "postMergeActions"
node_type = APP NAME
operation_name = "Post Merge Process"
params = {"actions": "Trigger deployments and notify team members"}
mode = "UC"

[edges]
create_pr = assign_reviewers
assign_reviewers = review_code
review_code = address_feedback
address_feedback = re_review
re_review = approval
approval = merge_pr
merge_pr = close_pr
close_pr = post_merge_actions
`.trim();
};

// Helper to retrieve an ACT artifact with sample PR Review workflow content
export const getActArtifact = () => {
  const content = generatePRReviewActFile();
  return createActDocument(content);
};

// Export the system object for external use
export const ActArtifactSystem = {
  systemPrompt,
  updateDocumentPrompt,
  validateActFile,
  validateNodeConnections,
  createActDocument,
  extractNodeNames,
  generatePRReviewActFile,
  getActArtifact,
};

export default ActArtifactSystem;

