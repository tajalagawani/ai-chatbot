export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WorkflowExecutionResult {
  success: boolean;
  executionId?: string;
  result?: any;
  error?: string;
}

export interface WorkflowValidationResult {
  success: boolean;
  isValid: boolean;
  workflow?: any;
  error?: string;
}

export interface WorkflowStatusResponse {
  success: boolean;
  executionId: string;
  status: WorkflowStatus;
  progress: number;
  result?: any;
  error?: string;
}

export interface ActNode {
  id: string;
  label: string;
  position_x: number;
  position_y: number;
  operation: string;
  node_type: 'APP NAME';
  operation_name: string;
  params: Record<string, any>;
  mode: string;
  api_key?: string;
  slack_token?: string;
  method?: string;
  formData?: Record<string, any>;
}

export interface ActWorkflow {
  workflow_id?: string;
  name: string;
  description: string;
  start_node: string;
  nodes: Record<string, ActNode>;
  edges: Array<{
    source: string;
    target: string;
  }>;
  env: Record<string, string>;
}