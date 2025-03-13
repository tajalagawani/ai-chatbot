// src/services/nodeApiService.ts

const API_BASE_URL = 'http://localhost:5088/api/nodes';

export interface NodeInfo {
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
}

export interface NodeSchema {
  properties: Record<string, any>;
  required: string[];
  title: string;
  description: string;
  type: string;
}

export interface NodeOperation {
  name: string;
  description: string;
}

export interface NodeExecutionParams {
  nodeId: string;
  workflowId: string;
  nodeType: string;
  operation?: string;
  params: Record<string, any>;
}

/**
 * Get information about a specific node type
 */
export const getNodeInfo = async (nodeType: string): Promise<NodeInfo> => {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching node info:', error);
    throw error;
  }
};

/**
 * Get the schema for a specific node type
 */
export const getNodeSchema = async (nodeType: string): Promise<NodeSchema> => {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}/schema`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node schema: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching node schema:', error);
    throw error;
  }
};

/**
 * Get available operations for a node type
 */
export const getNodeOperations = async (nodeType: string): Promise<NodeOperation[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}/operations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch node operations: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching node operations:', error);
    throw error;
  }
};

/**
 * Get detailed information about a specific operation
 */
export const getOperationDetails = async (nodeType: string, operationName: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/nodes/${nodeType}/operations/${operationName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch operation details: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching operation details:', error);
    throw error;
  }
};

/**
 * Execute a node operation
 * Note: Update this function with the actual endpoint when available
 */
export const executeNodeOperation = async (params: NodeExecutionParams): Promise<any> => {
  try {
    // This is a placeholder - replace with actual endpoint
    const response = await fetch(`${API_BASE_URL}/execute-node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to execute node: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error executing node operation:', error);
    throw error;
  }
};

// Export all API functions as a service object
const nodeApiService = {
  getNodeInfo,
  getNodeSchema,
  getNodeOperations,
  getOperationDetails,
  executeNodeOperation,
};

export default nodeApiService;