import React, { useEffect, useState, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:5088/api';

interface NodeDataManagerProps {
  nodeId: string;
  workflowId: string;
  initialNodeData?: any;
  onSave: (updatedData: any) => void;
}

interface ParsedNodeData {
  id: string;
  label: string;
  position_x: number;
  position_y: number;
  type: string;
  description: string;
  [key: string]: any;
}

/**
 * Custom hook to manage node data in the settings form
 */
export const useNodeDataManager = ({
  nodeId,
  workflowId,
  initialNodeData,
  onSave
}: NodeDataManagerProps) => {
  const [nodeData, setNodeData] = useState<ParsedNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Function to parse node data from the INI-like format
  const parseNodeData = (rawData: string): ParsedNodeData => {
    const result: ParsedNodeData = {
      id: '',
      label: '',
      position_x: 0,
      position_y: 0,
      type: '',
      description: ''
    };

    // Check if the data starts with a node section header
    const lines = rawData.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;
      
      // Check for section header [node:id]
      const sectionMatch = trimmedLine.match(/^\[node:(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        result.id = currentSection;
        continue;
      }
      
      // Parse key-value pairs
      const keyValueMatch = trimmedLine.match(/^(.+?)\s*=\s*(.*)$/);
      if (keyValueMatch) {
        const [, key, value] = keyValueMatch;
        
        // Handle numeric values
        if (!isNaN(Number(value)) && key !== 'token' && key !== 'repo' && key !== 'owner') {
          result[key] = Number(value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  };

  // Function to serialize node data back to INI-like format
  const serializeNodeData = (data: ParsedNodeData): string => {
    let result = `[node:${data.id}]\n`;
    
    // Add all properties as key-value pairs
    for (const [key, value] of Object.entries(data)) {
      // Skip undefined or null values
      if (value === undefined || value === null) continue;
      
      result += `${key} = ${value}\n`;
    }
    
    return result;
  };

  // Fetch node data
  const fetchNodeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // If we have initialNodeData as an object with formData, convert it
      if (initialNodeData && initialNodeData.formData) {
        const convertedData: ParsedNodeData = {
          id: nodeId,
          label: initialNodeData.type || nodeId,
          position_x: initialNodeData.position?.x || 0,
          position_y: initialNodeData.position?.y || 0,
          type: initialNodeData.type?.toLowerCase() || 'unknown',
          description: initialNodeData.description || '',
          ...initialNodeData.formData
        };
        
        setNodeData(convertedData);
      } 
      // If we have initialNodeData as a string in INI format
      else if (typeof initialNodeData === 'string') {
        const parsedData = parseNodeData(initialNodeData);
        setNodeData(parsedData);
      }
      // Otherwise fetch from API using the same API_BASE_URL from DynamicNodeSettings
      else {
        const response = await fetch(`${API_BASE_URL}/nodes/${nodeId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch node data (HTTP ${response.status})`);
        }
        
        const data = await response.text();
        const parsedData = parseNodeData(data);
        setNodeData(parsedData);
      }
    } catch (err) {
      console.error("Error fetching node data:", err);
      setError(`Failed to load node data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [nodeId, workflowId, initialNodeData]);

  // Update a specific field in the node data
  const updateNodeField = useCallback((key: string, value: any) => {
    setNodeData(prev => {
      if (!prev) return null;
      
      const updatedData = { ...prev, [key]: value };
      setIsDirty(true);
      return updatedData;
    });
  }, []);

  // Update node data with operation-specific fields
  const updateNodeWithOperationFields = useCallback((operation: string, operationFields: Record<string, any>) => {
    setNodeData(prev => {
      if (!prev) return null;
      
      // Create a new object with all the previous fields
      const updatedData = { ...prev };
      
      // Set the operation
      updatedData.operation = operation;
      
      // Add all operation-specific fields
      for (const [key, value] of Object.entries(operationFields)) {
        // Skip undefined, null, or empty string values
        if (value === undefined || value === null || value === '') continue;
        updatedData[key] = value;
      }
      
      setIsDirty(true);
      return updatedData;
    });
  }, []);

  // Save the node data
  const saveNodeData = useCallback(async () => {
    if (!nodeData) return;
    
    try {
      setError(null);
      
      // Convert node data to the INI-like format
      const serializedData = serializeNodeData(nodeData);
      
      // Use the same API_BASE_URL as DynamicNodeSettings
      const response = await fetch(`${API_BASE_URL}/workflows/${workflowId}/nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: serializedData
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save node data (HTTP ${response.status})`);
      }
      
      // Pass the updated data to the parent component
      onSave(serializedData);
      
      setIsDirty(false);
    } catch (err) {
      console.error("Error saving node data:", err);
      setError(`Failed to save node data: ${err.message}`);
    }
  }, [nodeData, nodeId, workflowId, onSave]);

  // Convert form data to node data
  const convertFormDataToNodeData = useCallback((formData: any) => {
    if (!nodeData) return;
    
    const updatedData = { ...nodeData };
    
    // Add all form fields to node data
    for (const [key, value] of Object.entries(formData)) {
      if (key === 'operation') {
        updatedData.operation = value;
      } else {
        updatedData[key] = value;
      }
    }
    
    setNodeData(updatedData);
    setIsDirty(true);
    return updatedData;
  }, [nodeData]);

  // Execute the node
  const executeNode = useCallback(async (formData: any) => {
    try {
      setError(null);
      
      // Create execution payload from node data
      const executionPayload = {
        node_id: nodeId,
        workflow_id: workflowId,
        ...formData
      };
      
      // Use the same API_BASE_URL and endpoint as in DynamicNodeSettings
      const nodeType = nodeData?.type || '';
      const response = await fetch(`${API_BASE_URL}/execute/${nodeType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(executionPayload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to execute node (HTTP ${response.status})`);
      }
      
      return await response.json();
    } catch (err) {
      console.error("Error executing node:", err);
      setError(`Execution failed: ${err.message}`);
      throw err;
    }
  }, [nodeId, workflowId, nodeData]);

  // Initialize on component mount
  useEffect(() => {
    fetchNodeData();
  }, [fetchNodeData]);

  return {
    nodeData,
    loading,
    error,
    isDirty,
    updateNodeField,
    updateNodeWithOperationFields,
    saveNodeData,
    convertFormDataToNodeData,
    executeNode,
    serializeNodeData
  };
};

interface NodeSettingsManagerProps {
  nodeData: any;
  workflowId: string;
  nodeId: string;
  onSave: (updatedData: any) => void;
  onExecutionComplete?: (response: any) => void;
  children: (props: {
    nodeData: ParsedNodeData | null;
    loading: boolean;
    error: string | null;
    updateNodeField: (key: string, value: any) => void;
    saveNodeData: () => Promise<void>;
    executeNode: (formData: any) => Promise<any>;
    convertFormDataToNodeData: (formData: any) => ParsedNodeData | undefined;
  }) => React.ReactNode;
}

/**
 * Component to integrate with your DynamicNodeSettings
 */
const NodeSettingsManager: React.FC<NodeSettingsManagerProps> = ({ 
  nodeData, 
  workflowId, 
  nodeId, 
  onSave,
  onExecutionComplete,
  children 
}) => {
  const {
    nodeData: parsedNodeData,
    loading,
    error,
    updateNodeField,
    saveNodeData,
    executeNode,
    convertFormDataToNodeData
  } = useNodeDataManager({
    nodeId,
    workflowId,
    initialNodeData: nodeData,
    onSave
  });

  // Wrapper for executeNode that calls onExecutionComplete
  const handleExecute = async (formData: any) => {
    try {
      const result = await executeNode(formData);
      if (onExecutionComplete) {
        onExecutionComplete(result);
      }
      return result;
    } catch (err) {
      // Error is already handled in executeNode
      return null;
    }
  };

  return (
    <>
      {children({
        nodeData: parsedNodeData,
        loading,
        error,
        updateNodeField,
        saveNodeData,
        executeNode: handleExecute,
        convertFormDataToNodeData
      })}
    </>
  );
};

export default NodeSettingsManager;