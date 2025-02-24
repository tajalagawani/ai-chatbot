'use client';

import React, { memo, useEffect } from 'react';
import { MarkerType } from 'reactflow';
import BaseNode from './../../components/BaseNode'; // Import the BaseNode component
import useSWR from 'swr';

// Helper function to convert any value to an object
function convertToObject(value) {
  // If it's already an object, return it
  if (typeof value === 'object' && value !== null) return value;
  
  // If it's a string, try to parse it as JSON
  if (typeof value === 'string') {
    try {
      // First attempt: direct JSON parse
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      // Second attempt: quoted JSON - sometimes params might be escaped twice
      try {
        // Handle double-quoted JSON strings
        if (value.startsWith('"') && value.endsWith('"')) {
          const unquoted = value.slice(1, -1).replace(/\\"/g, '"');
          const parsed = JSON.parse(unquoted);
          if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
          }
        }
      } catch (e2) {
        // Third attempt: simple key:value format
        try {
          if (value.includes(':') && !value.includes('{')) {
            const props = value.split(',');
            const result = {};
            props.forEach(prop => {
              const [key, val] = prop.split(':').map(p => p.trim());
              if (key && val) {
                result[key] = val;
              }
            });
            return result;
          }
        } catch (e3) {
          console.warn('All attempts to convert string to object failed:', value);
        }
      }
    }
  }
  
  // Return empty object as fallback
  return {};
}

// Custom hook to fetch the latest document content
export function useLatestDocument(documentId) {
  const { data, error, mutate } = useSWR(
    documentId ? `/api/document?id=${documentId}` : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      return response.json();
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 5000 // Check for updates every 5 seconds
    }
  );

  // Function to manually check for updates
  const checkForUpdates = async () => {
    if (documentId) {
      await mutate();
    }
  };

  return {
    document: data,
    isLoading: !error && !data,
    isError: error,
    checkForUpdates,
    mutate
  };
}

// Define node types outside components to avoid recreation
export const nodeTypes = {
  process: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Core"
      nodeType="process"
      icon={<span className="text-3xl">🔄</span>}
      onNodeDataChange={(id, newData) => {
        // This will be handled by the flow state management
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
  decision: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Core"
      nodeType="decision"
      icon={<span className="text-3xl">⚙️</span>}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
  error: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Output"
      nodeType="error"
      icon={<span className="text-3xl">❌</span>}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
  end: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Output"
      nodeType="end"
      icon={<span className="text-3xl">🏁</span>}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
  start: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Input"
      nodeType="start"
      icon={<span className="text-3xl">🚀</span>}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
  default: memo(({ data, id, selected }) => (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeKind="Default"
      nodeType="default"
      icon={<span className="text-3xl">📦</span>}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node delete requested:', id);
      }}
    />
  )),
};

// Function to detect if content is ACT workflow format
export function isActContent(content) {
  if (!content) return false;
  
  // Check for ACT format indicators using your original logic
  return (
    content.includes('[workflow]') || 
    content.includes('[node:') ||
    (content.includes('start_node') && content.includes('operation'))
  );
}

// Function to determine node kind based on your original logic
function determineNodeKind(node, edges, workflow) {
  const isTarget = edges.some(edge => edge.target === node.id);
  const isSource = edges.some(edge => edge.source === node.id);
  
  if (node.id === workflow.start_node || (!isTarget && isSource)) {
    return 'Input';
  } else if (isTarget && !isSource) {
    return 'Output';
  } else if (isTarget && isSource) {
    return 'Core';
  }
  return 'Default';
}

// Repair document function - fixes common issues in ACT files
function repairDocument(content) {
  if (!content) return content;
  
  const lines = content.split('\n');
  const repairedLines = [];
  let currentNodeId = null;
  
  for (let line of lines) {
    const trimmedLine = line.trim();
    
    // Detect node sections
    if (trimmedLine.startsWith('[node:') && trimmedLine.endsWith(']')) {
      currentNodeId = trimmedLine.substring(6, trimmedLine.length - 1);
      repairedLines.push(line);
      continue;
    }
    
    // Fix params property
    if (trimmedLine.startsWith('params =')) {
      // Check if it's a string representation that's not valid JSON
      const valueStr = trimmedLine.substring('params ='.length).trim();
      
      if (valueStr === '""' || valueStr === "''") {
        // Empty string params - replace with empty object
        repairedLines.push('params = {}');
        console.log(`Fixed empty params for node: ${currentNodeId}`);
        continue;
      }
      
      // If it doesn't start with { or has no closing }, convert to empty object
      if ((!valueStr.startsWith('{') || !valueStr.includes('}')) && 
          (!valueStr.startsWith('[') || !valueStr.includes(']'))) {
        // Replace with empty object
        repairedLines.push('params = {}');
        console.log(`Fixed params for node: ${currentNodeId}`);
        continue;
      }
    }
    
    // Convert position_x and position_y strings to numbers
    if (trimmedLine.startsWith('position_x =') || trimmedLine.startsWith('position_y =')) {
      const parts = trimmedLine.split('=');
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      
      // If it's a string that's not a number, convert to number
      if (value.startsWith('"') && value.endsWith('"')) {
        const numValue = parseFloat(value.slice(1, -1));
        if (!isNaN(numValue)) {
          repairedLines.push(`${key} = ${numValue}`);
          continue;
        }
      }
    }
    
    // Keep other lines as-is
    repairedLines.push(line);
  }
  
  return repairedLines.join('\n');
}

// Parse workflow string to ReactFlow format with improved error handling
export function parseWorkflow(content) {
  if (!content) return { workflow: {}, nodes: [], edges: [], env: {}, isValid: false };
  
  // Check if this is valid ACT content
  if (!isActContent(content)) {
    console.warn('Content does not appear to be in ACT format');
    return { workflow: {}, nodes: [], edges: [], env: {}, isValid: false };
  }
  
  try {
    // First repair the document to fix common issues
    content = repairDocument(content);
    
    // Object to store all parsed nodes with proper params
    const processedNodes = {};
    
    const lines = content.split('\n');
    const workflow = {};
    let currentSection = null;
    let nodes = {};
    let edges = {};
    let env = {};
    let edgesRaw = {};
    let edgesList = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Check for section headers
      if (line.startsWith('[') && line.endsWith(']')) {
        const sectionName = line.substring(1, line.length - 1);
        
        if (sectionName === 'workflow') {
          currentSection = 'workflow';
        } else if (sectionName === 'edges') {
          currentSection = 'edges';
        } else if (sectionName === 'env') {
          currentSection = 'env';
        } else if (sectionName.startsWith('node:')) {
          currentSection = sectionName.substring(5); // Extract node name
          nodes[currentSection] = {
            id: currentSection,
            type: 'process', // Default type - required by server
            app_name: 'System', // Default app_name - required by server
            mode: 'UC', // Default mode - required by server
            operation: 'process', // Default operation
            operation_name: 'process', // Default operation_name
            label: currentSection, // Default label
            params: {}, // Empty params object - must be an object
            position_x: 0, // Default X position - must be a number
            position_y: 0, // Default Y position - must be a number
          };
        }
        continue;
      }
      
      // Process key-value pairs
      if (line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const trimmedKey = key.trim();
        let value = valueParts.join('=').trim();
        
        // Handle quoted strings
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        
        // Handle JSON objects like params
        if ((value.startsWith('{') && value.endsWith('}')) || 
            (value.startsWith('[') && value.endsWith(']'))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.log('Error parsing JSON:', value);
            // For params specifically, use the convertToObject function
            if (trimmedKey === 'params') {
              value = convertToObject(value);
            }
          }
        }
        
        // Always ensure params is an object
        if (trimmedKey === 'params') {
          value = convertToObject(value);
        }
        
        // Always convert numeric strings to numbers for position fields
        if ((trimmedKey === 'position_x' || trimmedKey === 'position_y') && 
            typeof value === 'string' && value !== '') {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            value = parsed;
          } else {
            // Default to 0 for invalid position values
            value = 0;
          }
        }
        
        // Store in appropriate section
        if (currentSection === 'workflow') {
          workflow[trimmedKey] = value;
        } else if (currentSection === 'edges') {
          edges[trimmedKey] = value;
          edgesRaw[trimmedKey] = value; // Keep the raw edges
          // Also add to edges list for determining node kind
          edgesList.push({ source: trimmedKey, target: value });
        } else if (currentSection === 'env') {
          env[trimmedKey] = value;
        } else if (nodes[currentSection]) {
          // Assign to node properties
          nodes[currentSection][trimmedKey] = value;
        }
      }
    }
    
    // Add a start node if referenced but not defined
    if (workflow.start_node && !nodes[workflow.start_node]) {
      nodes[workflow.start_node] = {
        id: workflow.start_node,
        type: 'start',
        app_name: 'System', // Required by server
        label: 'Start',
        position_x: 250,
        position_y: 50,
        operation: 'start',
        operation_name: 'startWorkflow',
        params: {},
        mode: 'UC'
      };
    }
    
    // Validate - make sure we have at least one node
    if (Object.keys(nodes).length === 0) {
      console.warn('No nodes found in ACT content');
      return { workflow, nodes: [], edges: [], env, edgesRaw, isValid: true };
    }
    
    // Convert edges to ReactFlow format
    const reactFlowEdges = [];
    for (const [source, target] of Object.entries(edges)) {
      // Skip edges with non-existent nodes
      if (!nodes[source] || !nodes[target]) continue;
      
      // Get the appropriate source and target handles based on node types
      // Using the handle IDs from the BaseNode component
      const sourceNode = nodes[source];
      const targetNode = nodes[target];
      
      // Determine node kinds based on connections
      const sourceNodeKind = determineNodeKind(sourceNode, edgesList, workflow);
      const targetNodeKind = determineNodeKind(targetNode, edgesList, workflow);
      
      // Set appropriate handles based on node kinds
      let sourceHandle;
      let targetHandle;
      
      // Use "right" for output from any node
      sourceHandle = "right";
      
      // Use "left" for input to any node
      targetHandle = "left";
      
      reactFlowEdges.push({
        id: `e-${source}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#555' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#555',
        },
        data: { originalSource: source, originalTarget: target }
      });
    }
    
    // Process nodes to ensure proper formatting
    Object.entries(nodes).forEach(([nodeId, node]) => {
      // Clone node to avoid modifying original
      const processedNode = { ...node };
      
      // Ensure required fields are present
      if (!processedNode.type) processedNode.type = 'process';
      if (!processedNode.app_name) processedNode.app_name = 'System';
      if (!processedNode.mode) processedNode.mode = 'UC';
      if (!processedNode.operation) processedNode.operation = 'process';
      if (!processedNode.operation_name) processedNode.operation_name = 'process';
      if (!processedNode.label) processedNode.label = nodeId;
      
      // Double-check params is an object
      processedNode.params = convertToObject(processedNode.params);
      
      // Ensure position values are numbers
      processedNode.position_x = typeof processedNode.position_x === 'number' 
        ? processedNode.position_x 
        : (typeof processedNode.position_x === 'string' 
            ? parseFloat(processedNode.position_x) || 0 
            : 0);
            
      processedNode.position_y = typeof processedNode.position_y === 'number' 
        ? processedNode.position_y 
        : (typeof processedNode.position_y === 'string' 
            ? parseFloat(processedNode.position_y) || 0 
            : 0);
      
      // Store processed node
      processedNodes[nodeId] = processedNode;
    });
    
    // Convert nodes to ReactFlow format
    const reactFlowNodes = Object.values(processedNodes).map(node => {
      // If this is a start node, make sure the type is 'start'
      if (node.id === workflow.start_node && node.type !== 'start') {
        node.type = 'start';
      }
      
      // Determine node kind for proper rendering
      const nodeKind = determineNodeKind(node, edgesList, workflow);
      
      return {
        id: node.id,
        type: node.type,
        data: { 
          label: node.label,
          operation: node.operation,
          operation_name: node.operation_name,
          app_name: node.app_name,
          mode: node.mode,
          params: node.params,
          nodeKind: nodeKind, // Add nodeKind for proper styling
          ...node
        },
        position: { 
          x: node.position_x,
          y: node.position_y
        }
      };
    });
    
    return {
      workflow,
      nodes: reactFlowNodes,
      edges: reactFlowEdges,
      env,
      edgesRaw,
      isValid: true
    };
  } catch (error) {
    console.error('Error parsing workflow:', error);
    // Return empty result with isValid flag
    return { workflow: {}, nodes: [], edges: [], env: {}, isValid: false };
  }
}

// Convert ReactFlow data back to workflow format with improved validation
export function generateWorkflowCode(workflow, nodes, edges, env, edgesRaw = {}) {
  try {
    // Use array joining instead of string concatenation for better performance
    const codeChunks = ['[workflow]\n'];
    
    // Add workflow section
    Object.entries(workflow).forEach(([key, value]) => {
      if (typeof value === 'string') {
        codeChunks.push(`${key} = "${value}"\n`);
      } else {
        codeChunks.push(`${key} = ${value}\n`);
      }
    });
    
    // Create a map of node properties to avoid recalculating
    const nodeProps = new Map();
    
    // Add node sections - process in batches for better performance
    nodes.forEach(node => {
      const nodeChunks = [`\n[node:${node.id}]\n`];
      
      // Skip processing a node we've already processed with the same data
      const nodeKey = `${node.id}-${JSON.stringify(node.data)}-${JSON.stringify(node.position)}`;
      if (nodeProps.has(nodeKey)) {
        codeChunks.push(nodeProps.get(nodeKey));
        return;
      }
      
      // Extract node properties excluding ReactFlow-specific ones
      const nodeData = { ...node.data };
      delete nodeData.label; // We'll add this separately
      delete nodeData.onNodeDataChange; // Remove handler functions
      delete nodeData.onNodeDelete;
      delete nodeData.allNodes;
      delete nodeData.allEdges;
      delete nodeData.nodeKind; // Remove calculated node kind
      
      // Ensure required fields are present and in the correct order
      // Type is required
      nodeChunks.push(`type = "${node.data.type || 'process'}"\n`);
      
      // Label is required
      nodeChunks.push(`label = "${node.data.label || node.id}"\n`);
      
      // Position values - must be numbers
      nodeChunks.push(`position_x = ${Math.round(node.position.x)}\n`);
      nodeChunks.push(`position_y = ${Math.round(node.position.y)}\n`);
      
      // Operation is required
      nodeChunks.push(`operation = "${node.data.operation || 'process'}"\n`);
      
      // App name is required
      nodeChunks.push(`app_name = "${node.data.app_name || 'System'}"\n`);
      
      // Operation name is required
      nodeChunks.push(`operation_name = "${node.data.operation_name || 'process'}"\n`);
      
      // Params must be an object - use convertToObject for extra safety
      const paramsValue = convertToObject(node.data.params);
      nodeChunks.push(`params = ${JSON.stringify(paramsValue)}\n`);
      
      // Mode is required
      nodeChunks.push(`mode = "${node.data.mode || 'UC'}"\n`);
      
      // Filter properties to only include additional fields
      const relevantProps = Object.entries(nodeData).filter(([key, value]) => {
        return !(['id', 'type', 'label', 'position_x', 'position_y', 'operation', 'app_name', 'operation_name', 'params', 'mode', 'nodeKind'].includes(key)) 
          && value !== undefined && value !== null;
      });
      
      // Add other properties
      relevantProps.forEach(([key, value]) => {
        if (typeof value === 'string') {
          nodeChunks.push(`${key} = "${value}"\n`);
        } else if (typeof value === 'object') {
          nodeChunks.push(`${key} = ${JSON.stringify(value)}\n`);
        } else {
          nodeChunks.push(`${key} = ${value}\n`);
        }
      });
      
      const nodeSection = nodeChunks.join('');
      nodeProps.set(nodeKey, nodeSection);
      codeChunks.push(nodeSection);
    });
    
    // Add edges section
    codeChunks.push('[edges]\n');
    
    // Create a map of source -> target edges from the current flow
    const flowEdges = {};
    edges.forEach(edge => {
      flowEdges[edge.source] = edge.target;
    });
    
    // Combine original edges with current flow edges
    const allEdgeSources = new Set([
      ...Object.keys(edgesRaw),
      ...Object.keys(flowEdges)
    ]);
    
    allEdgeSources.forEach(source => {
      // If the edge exists in the current flow, use that; otherwise use the original if it exists
      const target = flowEdges[source] || edgesRaw[source];
      if (target) {
        codeChunks.push(`${source} = ${target}\n`);
      }
    });
    
    // Add env section
    if (Object.keys(env).length > 0) {
      codeChunks.push('\n[env]\n');
      Object.entries(env).forEach(([key, value]) => {
        if (typeof value === 'string') {
          codeChunks.push(`${key} = "${value}"\n`);
        } else {
          codeChunks.push(`${key} = ${value}\n`);
        }
      });
    }
    
    return codeChunks.join('');
  } catch (error) {
    console.error('Error generating workflow code:', error);
    // Return empty content to avoid saving invalid data
    return '';
  }
}

// Flow Editor Component that always checks for latest updates
export const DocumentSyncWrapper = ({ children, documentId }) => {
  const { document, isLoading, isError, checkForUpdates } = useLatestDocument(documentId);
  
  // Periodically check for updates
  useEffect(() => {
    // Initial check
    checkForUpdates();
    
    // Set up interval to check regularly
    const interval = setInterval(() => {
      checkForUpdates();
    }, 5000);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [checkForUpdates]);
  
  // You can add logic here to handle loading/error states
  if (isLoading) {
    return <div>Loading document...</div>;
  }
  
  if (isError) {
    return <div>Error loading document</div>;
  }
  
  // Pass the latest document content to children
  return React.cloneElement(children, { 
    content: document?.content || '',
    latestDocument: document,
    refreshDocument: checkForUpdates
  });
};