'use client';

// Declare global types
declare global {
  interface Window {
    _flowNodes: any[];
    _flowEdges: any[];
  }
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowInstance,
  NodeChange,
  EdgeChange,
  Viewport,
  XYPosition,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeTypes,
  EdgeTypes,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import BaseNode from './BaseNode';
import CustomEdge from './CustomEdge';
import { Result } from 'postcss';

interface ActFlowVisualizerProps {
  content: string;
  isStreaming?: boolean;
  metadata?: any;
  setMetadata?: (metadata: any) => void;
  onContentChange?: (content: string, debounce?: boolean) => void;
  onLayoutChange?: (layout: { nodes: Node[]; edges: Edge[] }) => void;
  initialLayout?: { nodes: Node[]; edges: Edge[] };
  status?: 'streaming' | 'idle' | 'updating' | 'error';
}

// Original content sections structure
interface ActContentSections {
  workflow: {
    workflow_id: string;
    name: string;
    description: string;
    start_node: string;
    [key: string]: any;
  };
  parameters?: Record<string, any>;
  nodes: Record<string, any>;
  edges: Array<{source: string, target: string}>;
  settings?: Record<string, any>;
  env?: Record<string, any>;
  [key: string]: any; // Allow for other sections we don't explicitly handle
}

function parseIncrementalContent(content: string, previousNodes = {}): ActContentSections {
  const sections: ActContentSections = {
    workflow: { 
      workflow_id: '',
      name: '',
      description: '',
      start_node: '' 
    },
    // Important: Don't copy all previousNodes - we'll only preserve positions
    nodes: {},
    edges: [],
    parameters: {},
    settings: {},
    env: {}
  };
  
  // Track original structure of each node
  const originalStructure = {};
  
  const lines = content.split('\n').map(line => line.trim());
  let currentSection = '';
  let currentNodeId = '';
  
  for (const line of lines) {
    if (line === '' || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1);
      
      // Handle node sections
      if (currentSection.startsWith('node:')) {
        currentNodeId = currentSection.split(':')[1];
        
        // Initialize node with only essential properties
        // Only preserve position from previousNodes if available
        if (!sections.nodes[currentNodeId]) {
          // Get positions from previousNodes if available, otherwise use random values
          const position_x = previousNodes[currentNodeId]?.position_x || Math.random() * 500;
          const position_y = previousNodes[currentNodeId]?.position_y || Math.random() * 500;
          
          sections.nodes[currentNodeId] = {
            id: currentNodeId,
            label: currentNodeId,
            position_x,
            position_y,
            _originalProperties: ['id', 'label', 'position_x', 'position_y'] // Start with only essential properties
          };
        }
        
        // Initialize the structure tracker for this node
        if (!originalStructure[currentNodeId]) {
          originalStructure[currentNodeId] = {
            properties: ['id', 'label', 'position_x', 'position_y'],
            order: ['id', 'label', 'position_x', 'position_y']
          };
        }
      } 
      // Initialize other sections if they don't exist
      else if (!sections[currentSection] && currentSection !== 'workflow' && currentSection !== 'edges') {
        sections[currentSection] = {};
      }
      
      continue;
    }

    if (line.includes('=')) {
      const equalsIndex = line.indexOf('=');
      const key = line.substring(0, equalsIndex).trim();
      const value = line.substring(equalsIndex + 1).trim();
      
      let parsedValue = value;
      
      try {
        // Check if it's a template variable pattern like {{variable.property}}
        if (value.match(/^\{\{.*\}\}$/)) {
          // It's a template variable, keep as is
          parsedValue = value;
        }
        // Check if it's JSON
        else if (value.startsWith('{') && value.endsWith('}')) {
          try {
            parsedValue = JSON.parse(value);
          } catch (jsonError) {
            // If JSON parsing fails, keep as string
            parsedValue = value;
          }
        } 
        else if (value.startsWith('"') && value.endsWith('"')) {
          parsedValue = value.slice(1, -1);
        }
        else if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        else {
          // Keep the value as is, including any structured content
          parsedValue = value;
        }
      } catch (e) {
        console.error(`Failed to parse value: ${value}`, e);
        // If parsing fails, keep the original text value
        parsedValue = value;
      }

      if (currentSection.startsWith('node:')) {
        const nodeId = currentSection.split(':')[1];
        
        // Store the property
        sections.nodes[nodeId][key] = parsedValue;
        
        // Track this property as part of the original structure
        if (!sections.nodes[nodeId]._originalProperties.includes(key)) {
          sections.nodes[nodeId]._originalProperties.push(key);
        }
        
        // Track property order and presence for reconstruction
        if (originalStructure[nodeId]) {
          originalStructure[nodeId].properties.push(key);
          originalStructure[nodeId].order.push(key);
        }
      } else if (currentSection === 'edges') {
        // For edges, store the raw target value without modification
        sections.edges.push({
          source: key,
          target: typeof parsedValue === 'string' ? 
            parsedValue.replace(/^"(.*)"$/, '$1') : // Remove enclosing quotes if present
            String(parsedValue)
        });
      } else if (currentSection === 'workflow') {
        sections.workflow[key] = parsedValue;
      } else if (currentSection === 'parameters') {
        sections.parameters[key] = parsedValue;
      } else if (currentSection === 'settings') {
        sections.settings[key] = parsedValue;
      } else if (currentSection === 'env') {
        sections.env[key] = parsedValue;
      } else if (sections[currentSection] !== undefined) {
        // Store values for other sections
        sections[currentSection][key] = parsedValue;
      }
    }
  }

  // Store the original structure information on each node
  Object.keys(originalStructure).forEach(nodeId => {
    if (sections.nodes[nodeId]) {
      sections.nodes[nodeId]._originalStructure = originalStructure[nodeId];
    }
  });

  // Log the parsed nodes for debugging
  console.log("Parsed nodes (no unwanted properties should be here):", 
    Object.keys(sections.nodes).map(id => ({
      id,
      properties: sections.nodes[id]._originalProperties
    }))
  );

  return sections;
}

function determineNodeKind(node: any, workflow: any): 'Input' | 'Core' | 'Output' | 'Default' {
  if (!workflow?.edges) return 'Default';
  
  const isTarget = workflow.edges.some((edge: any) => edge.target === node.id);
  const isSource = workflow.edges.some((edge: any) => edge.source === node.id);
  
  if (node.id === workflow.workflow?.start_node || (!isTarget && isSource)) {
    return 'Input';
  } else if (isTarget && !isSource) {
    return 'Output';
  } else if (isTarget && isSource) {
    return 'Core';
  }
  return 'Default';
}

// List of execution-related properties that should never be saved in ACT content
const EXECUTION_PROPERTIES = [
  'result', 
  'executionResponse', 
  'status', 
  'executionResult',
  'executionOutput', 
  '_executionData', 
  '_result'
];

// Updated to strictly preserve only properties in _originalProperties and filter execution data
function getActContentFromFlow(
  nodes: Node[], 
  edges: Edge[], 
  originalSections: ActContentSections
): string {
  // Create a deep copy of the original sections to start with
  const sections = JSON.parse(JSON.stringify(originalSections));
  
  // Update node positions from the flow diagram and strictly enforce _originalProperties
  nodes.forEach(node => {
    if (sections.nodes[node.id]) {
      // Create a clean node object with only essential properties
      const cleanNode = {
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      };
      
      // Get the list of properties that should be included (and ensure it exists)
      const propertiesToKeep = Array.isArray(node.data._originalProperties) 
        ? [...node.data._originalProperties].filter(prop => !EXECUTION_PROPERTIES.includes(prop))
        : ['id', 'position_x', 'position_y', 'type', 'label'];
      
      // Add _originalProperties to the clean node (filtered to remove execution data)
      cleanNode._originalProperties = propertiesToKeep;
      
      // ONLY copy properties that are explicitly listed in _originalProperties
      propertiesToKeep.forEach(propName => {
        if (propName !== 'id' && propName !== 'position_x' && propName !== 'position_y' && 
            !propName.startsWith('_') && !EXECUTION_PROPERTIES.includes(propName)) {
          // Copy the property from node.data to ensure we get the latest value
          cleanNode[propName] = node.data[propName];
        }
      });
      
      // Replace the node in sections with this clean version that only has allowed properties
      sections.nodes[node.id] = cleanNode;
    }
  });
  
  // Update edges from the flow diagram
  sections.edges = edges.map(edge => ({
    source: edge.source,
    target: edge.target
  }));
  
  // Update workflow start_node if needed
  const startNode = nodes.find(node => node.data.type === 'start' || node.id === 'start');
  if (startNode && startNode.id) {
    sections.workflow.start_node = startNode.id;
  }
  
  // Generate the content string based on the sections
  let content = '';
  
  // Add parameters section if it exists
  if (sections.parameters && Object.keys(sections.parameters).length > 0) {
    content += '[parameters]\n';
    for (const [key, value] of Object.entries(sections.parameters)) {
      // Format correctly based on value type
      if (typeof value === 'string') {
        if (value.startsWith('${') && value.endsWith('}')) {
          content += `${key} = ${value}\n`;
        } else {
          content += `${key} = "${value}"\n`;
        }
      } else {
        content += `${key} = ${JSON.stringify(value)}\n`;
      }
    }
    content += '\n';
  }
  
  // Add workflow section
  content += '[workflow]\n';
  for (const [key, value] of Object.entries(sections.workflow)) {
    if (value === undefined || value === '' || key.startsWith('_')) continue;
    
    if (typeof value === 'string') {
      content += `${key} = ${value}\n`;
    } else {
      content += `${key} = ${JSON.stringify(value)}\n`;
    }
  }
  content += '\n';
  
  // Add node sections - with strict property filtering
  for (const [nodeId, nodeData] of Object.entries(sections.nodes)) {
    content += `[node:${nodeId}]\n`;
    
    // Get list of properties to include (excluding internal ones)
    const propertiesToInclude = (nodeData._originalProperties || [])
      .filter(prop => !prop.startsWith('_') && !EXECUTION_PROPERTIES.includes(prop));
    
    // Only include properties that are in the _originalProperties array
    Object.entries(nodeData)
      .filter(([key]) => !key.startsWith('_') && propertiesToInclude.includes(key))
      .forEach(([key, value]) => {
        if (value === undefined || value === '') return;
        
        // Format the value based on its type
        if (typeof value === 'string') {
          if (value.startsWith('${') && value.includes('}')) {
            content += `${key} = ${value}\n`;
          } else if (['type', 'label', 'position_x', 'position_y', 'description',
                       'url', 'operation', 'method', 'api_key', 'model', 
                       'response_type', 'collection', 'timeout', 'verify_ssl',
                       'output_format'].includes(key)) {
            content += `${key} = ${value}\n`;
          } else {
            content += `${key} = ${value}\n`;
          }
        } else if (typeof value === 'object' && value !== null) {
          content += `${key} = ${JSON.stringify(value)}\n`;
        } else {
          content += `${key} = ${value}\n`;
        }
      });
    
    content += '\n';
  }
  
  // Add edges section
  if (sections.edges.length > 0) {
    content += '[edges]\n';
    for (const edge of sections.edges) {
      content += `${edge.source} = ${edge.target}\n`;
    }
    content += '\n';
  }
  
  // Add settings section if exists
  if (sections.settings && Object.keys(sections.settings).length > 0) {
    content += '[settings]\n';
    for (const [key, value] of Object.entries(sections.settings)) {
      if (value === undefined || value === '') continue;
      
      if (typeof value === 'string') {
        content += `${key} = ${value}\n`;
      } else {
        content += `${key} = ${JSON.stringify(value)}\n`;
      }
    }
    content += '\n';
  }
  
  // Add env section
  if (sections.env && Object.keys(sections.env).length > 0) {
    content += '[env]\n';
    for (const [key, value] of Object.entries(sections.env)) {
      if (value === undefined || value === '') continue;
      
      if (typeof value === 'string') {
        content += `${key} = ${value}\n`;
      } else {
        content += `${key} = ${JSON.stringify(value)}\n`;
      }
    }
    content += '\n';
  }
  
  return content;
}

export function isActContent(content: string): boolean {
  if (!content) return false;
  return (
    content.includes('[workflow]') || 
    content.includes('[node:') ||
    (content.includes('start_node') && content.includes('position_'))
  );
}
export const ActFlowVisualizer: React.FC<ActFlowVisualizerProps> = ({ 
  content, 
  isStreaming,
  metadata,
  setMetadata,
  onContentChange,
  onLayoutChange,
  initialLayout,
  status = 'idle'
}) => {
  // Use refs to always have access to the latest props
  const onContentChangeRef = useRef(onContentChange);
  const onLayoutChangeRef = useRef(onLayoutChange);
  const metadataRef = useRef(metadata);
  
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
    onLayoutChangeRef.current = onLayoutChange;
    metadataRef.current = metadata;
  }, [onContentChange, onLayoutChange, metadata]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previousNodesRef = useRef<Record<string, any>>({});
  const previousContentRef = useRef<string>('');
  const originalSectionsRef = useRef<ActContentSections | null>(null);
  const savingNodesRef = useRef(false);
  const nodeStatusRef = useRef<Record<string, any>>({});
  const nodeResultsRef = useRef<Record<string, any>>({});  // Keeps track of node results
  
  // Debug info
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [lastStatusUpdate, setLastStatusUpdate] = useState<Date | null>(null);

  const defaultViewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 1.5
  };

  // Generate a random ID for new nodes
  const generateNodeId = useCallback(() => {
    return `node-${Math.floor(Math.random() * 10000)}`;
  }, []);

  // Save flow layout
  const saveFlowLayout = useCallback(() => {
    if (!reactFlowInstance || !onLayoutChangeRef.current) return;
    
    const currentNodes = reactFlowInstance.getNodes();
    const currentEdges = reactFlowInstance.getEdges();
    
    console.log("Saving flow layout - nodes:", currentNodes.length, "edges:", currentEdges.length);
    
    // Save layout using the provided callback
    onLayoutChangeRef.current({
      nodes: currentNodes,
      edges: currentEdges
    });
  }, [reactFlowInstance]);

  // Save current flow state to content
  const saveFlowToContent = useCallback((debounce: boolean = false) => {
    if (savingNodesRef.current) {
      console.log('Already saving, skipping duplicate save');
      return;
    }
    
    const currentSaveFunction = onContentChangeRef.current;
    if (!currentSaveFunction) {
      console.error("onContentChange is not available");
      return;
    }
    
    // Mark we're in the process of saving
    savingNodesRef.current = true;
    
    try {
      // Generate updated content from current nodes and edges
      const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
      const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;
      
      // Generate content but preserve original structure
      const updatedContent = getActContentFromFlow(
        currentNodes, 
        currentEdges, 
        originalSectionsRef.current || {
          workflow: { workflow_id: '', name: '', description: '', start_node: '' },
          nodes: {},
          edges: []
        }
      );
      
      // Log the content for debugging
      console.log("Saving flow content:", updatedContent.substring(0, 100) + "...");
      
      // Call parent's onContentChange to save the changes using the same signature as CodeEditor
      currentSaveFunction(updatedContent, debounce);
      
      // Also save the layout if provided
      if (onLayoutChangeRef.current) {
        onLayoutChangeRef.current({
          nodes: currentNodes,
          edges: currentEdges
        });
      }
      
      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      
      // Update last saved time for debugging
      setLastSavedTime(new Date());
      
      if (!debounce) {
        // Notify user only for explicit saves, not debounced ones
        toast.success("Flow changes saved");
      }
    } catch (error) {
      console.error('Error saving flow content:', error);
      toast.error('Failed to save flow changes');
    } finally {
      // Mark save as complete
      setTimeout(() => {
        savingNodesRef.current = false;
      }, 500);
    }
  }, [nodes, edges, reactFlowInstance]);

  // Auto-save when there are unsaved changes
  useEffect(() => {
    if ((nodes.length > 0 || edges.length > 0) && hasUnsavedChanges) {
      const timer = setTimeout(() => {
        if (hasUnsavedChanges && onContentChangeRef.current) {
          console.log("Auto-saving flow after changes");
          saveFlowToContent(true); // Use debounce = true for auto-saves
        }
      }, 2000); // Match the debounce time in other components
      
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, hasUnsavedChanges, saveFlowToContent]);

  // Enhanced node changes handler with better position tracking
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    setHasUnsavedChanges(true);
    
    // Process position changes and update node records with precise coordinates
    const positionChanges = changes.filter(
      (change): change is NodeChange & { position: XYPosition } => 
        change.type === 'position' && 
        change.position !== undefined
    );

    if (positionChanges.length > 0) {
      // Update our internal node position records
      positionChanges.forEach(change => {
        if (change.position && previousNodesRef.current[change.id]) {
          previousNodesRef.current[change.id].position_x = change.position.x;
          previousNodesRef.current[change.id].position_y = change.position.y;
        }
      });
      
      // Check if this is the end of a drag operation
      const isDragEnd = positionChanges.some(change => change.dragging === false);
      
      if (isDragEnd && reactFlowInstance) {
        // Get precise node positions from the flow instance
        const updatedNodes = reactFlowInstance.getNodes();
        
        // Update previous nodes with precise positions
        updatedNodes.forEach(node => {
          if (previousNodesRef.current[node.id]) {
            previousNodesRef.current[node.id].position_x = node.position.x;
            previousNodesRef.current[node.id].position_y = node.position.y;
            
            // Update any non-execution properties from node.data that should be preserved
            Object.entries(node.data).forEach(([key, value]) => {
              if (key !== 'id' && key !== 'position' && key !== '__reactFlow' &&
                  !EXECUTION_PROPERTIES.includes(key) &&
                  previousNodesRef.current[node.id]._originalProperties?.includes(key)) {
                previousNodesRef.current[node.id][key] = value;
              }
            });
          }
        });
        
        // Use setTimeout to ensure state updates are processed first
        setTimeout(() => {
          saveFlowLayout();
        }, 0);
      }
    }
  }, [onNodesChange, reactFlowInstance, saveFlowLayout]);

  // Handle edge changes
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    setHasUnsavedChanges(true);
  }, [onEdgesChange]);

  // Handle connecting nodes (creating new edges)
  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({
        ...connection,
        id: `edge-${Math.floor(Math.random() * 10000)}`,
        type: 'custom',
        data: {
          isBackward: false
        }
      }, eds);
      
      setHasUnsavedChanges(true);
      return newEdges;
    });
  }, [setEdges]);

  // Add a new node
  const onAddNode = useCallback(() => {
    const nodeId = generateNodeId();
    const newNode: Node = {
      id: nodeId,
      type: 'baseNode',
      position: { 
        x: Math.random() * 400 + 50, 
        y: Math.random() * 400 + 50 
      },
      data: {
        label: `New Node ${nodeId}`,
        type: 'process',  // Use a default type
        formData: {}
      }
    };
    
    console.log("Adding new node:", newNode);
    
    setNodes(nds => [...nds, newNode]);
    
    // Also update in previousNodesRef for consistency
    previousNodesRef.current[nodeId] = {
      id: nodeId,
      label: `New Node ${nodeId}`,
      position_x: newNode.position.x,
      position_y: newNode.position.y,
      type: 'process',
      _originalProperties: ['type', 'label', 'position_x', 'position_y']
    };
    
    // Update original sections to include this new node
    if (originalSectionsRef.current) {
      originalSectionsRef.current.nodes[nodeId] = {
        id: nodeId,
        label: `New Node ${nodeId}`,
        position_x: newNode.position.x,
        position_y: newNode.position.y,
        type: 'process',
        _originalProperties: ['type', 'label', 'position_x', 'position_y']
      };
    }
    
    setHasUnsavedChanges(true);
  }, [setNodes, generateNodeId]);

  // Modified to filter out execution data from node properties
  const handleNodeDataChange = useCallback((id: string, newData: any) => {
    console.log("Node data completely replaced:", id, newData);
    
    // Filter out execution-related properties from node data
    const { result, executionResponse, status, ...filteredData } = newData;
    
    // For React Flow nodes state - use filtered data
    setNodes(nds => 
      nds.map(node => {
        if (node.id === id) {
          // Keep only position and id, replace all other data with filtered data
          return { 
            ...node, 
            data: {
              ...filteredData,
              id: node.id,
              // Preserve status from ref, not from node data directly
              status: nodeStatusRef.current[id],
              // Provide a function to get results instead of storing directly
              getNodeResult: () => nodeResultsRef.current[id]
            } 
          };
        }
        return node;
      })
    );
    
    // For previousNodesRef - only store config properties, not result data
    if (previousNodesRef.current[id]) {
      // Keep only essential positioning properties
      const position_x = previousNodesRef.current[id].position_x;
      const position_y = previousNodesRef.current[id].position_y;
      
      // Create a completely new object with just position and ID and filtered data
      previousNodesRef.current[id] = {
        id: id,
        position_x: position_x,
        position_y: position_y,
        // Add all filtered data
        ...filteredData,
        // Update _originalProperties array to track only config properties
        _originalProperties: Object.keys(filteredData)
          .filter(key => !EXECUTION_PROPERTIES.includes(key))
      };
    }
    
    // Do the same for originalSectionsRef
    if (originalSectionsRef.current && originalSectionsRef.current.nodes[id]) {
      // Keep only essential positioning properties
      const position_x = originalSectionsRef.current.nodes[id].position_x;
      const position_y = originalSectionsRef.current.nodes[id].position_y;
      
      // Create a completely new object with just position and ID and filtered data
      originalSectionsRef.current.nodes[id] = {
        id: id,
        position_x: position_x,
        position_y: position_y,
        // Add all filtered data
        ...filteredData,
        // Update _originalProperties array to track only config properties
        _originalProperties: Object.keys(filteredData)
          .filter(key => !EXECUTION_PROPERTIES.includes(key))
      };
    }
    
    setHasUnsavedChanges(true);
  }, [setNodes]);

  // Handle node deletion
  const handleNodeDelete = useCallback((id: string) => {
    console.log("Deleting node:", id);
    
    setNodes(nds => nds.filter(node => node.id !== id));
    setEdges(eds => eds.filter(edge => edge.source !== id && edge.target !== id));
    
    // Clean up previousNodesRef
    if (previousNodesRef.current[id]) {
      delete previousNodesRef.current[id];
    }
    
    // Clean up nodeStatusRef
    if (nodeStatusRef.current[id]) {
      delete nodeStatusRef.current[id];
    }
    
    // Clean up nodeResultsRef
    if (nodeResultsRef.current[id]) {
      delete nodeResultsRef.current[id];
    }
    
    // Remove node from original sections
    if (originalSectionsRef.current && originalSectionsRef.current.nodes[id]) {
      delete originalSectionsRef.current.nodes[id];
    }
    
    // Update edges in original sections
    if (originalSectionsRef.current) {
      originalSectionsRef.current.edges = originalSectionsRef.current.edges.filter(
        edge => edge.source !== id && edge.target !== id
      );
    }
    
    setHasUnsavedChanges(true);
  }, [setNodes, setEdges]);

  // Get node result function that can be called by BaseNode when needed
  const getNodeResult = useCallback((nodeId: string) => {
    return nodeResultsRef.current[nodeId] || 
           metadata?.executionResult?.results?.[nodeId];
  }, [metadata?.executionResult?.results]);

  // Enhanced effect to properly process execution data from metadata
  useEffect(() => {
    // Skip if no metadata or nodeStatus
    if (!metadata?.nodeStatus || Object.keys(metadata.nodeStatus).length === 0) return;
    
    // Store the node status in our ref for persistence
    nodeStatusRef.current = {
      ...nodeStatusRef.current,
      ...metadata.nodeStatus
    };
    
    // Update nodes with status information - but don't store results directly in node data
    setNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          status: metadata.nodeStatus[node.id] || nodeStatusRef.current[node.id] || node.data.status,
          // Provide function to get results instead of storing directly
          getNodeResult: () => nodeResultsRef.current[node.id] || 
                              metadata?.executionResult?.results?.[node.id]
        }
      }))
    );
    
    // Update the last status update time
    setLastStatusUpdate(new Date());
    
    console.log('Updated flow nodes with execution data:', Object.keys(metadata.nodeStatus).length, 'nodes');
  }, [metadata?.nodeStatus, setNodes, metadata?.executionResult?.results]);

  // Add this effect to expose nodes and edges globally
  useEffect(() => {
    // Make nodes and edges available globally for components that need them
    window._flowNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        // Add result from ref to the global data structure only (not to the nodes)
        result: nodeResultsRef.current[node.id],
        // Add execution response from metadata to global data structure only
        executionResponse: metadata?.executionResult?.results && 
                         metadata.executionResult.results[node.id]
      }
    }));
    window._flowEdges = edges;
    
    // Add debug information
    console.log('Global flow data updated:', 
      window._flowNodes.length, 'nodes,', 
      window._flowEdges.length, 'edges'
    );
  }, [nodes, edges, metadata?.executionResult?.results]);
  
  useEffect(() => {
    // Skip if no execution results
    if (!metadata?.executionResult?.results || 
        Object.keys(metadata.executionResult.results).length === 0) return;
    
    // Store the node results in our ref for persistence
    nodeResultsRef.current = {
      ...nodeResultsRef.current,
      ...metadata.executionResult.results
    };
    
    // Update nodes to provide access to results via function - but don't store directly in node data
    setNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          // Update the function to get results instead of storing directly
          getNodeResult: () => nodeResultsRef.current[node.id] || 
                              metadata.executionResult.results[node.id]
        }
      }))
    );
    
    console.log('Updated flow nodes to access execution results:', 
      Object.keys(metadata.executionResult.results).length, 'nodes');
  }, [metadata?.executionResult?.results, setNodes]);

// Add a separate effect for real-time node status updates during execution
useEffect(() => {
  // Skip if no execution in progress
  if (!metadata?.executionId || !metadata?.port || metadata?.executionStatus !== 'running') return;

  let isMounted = true;
  let statusCheckInterval;

  const checkNodeStatus = async () => {
    try {
      // Check node status endpoint
      const response = await fetch(
        `http://localhost:${metadata.port}/node-status/${metadata.executionId}`,
        { signal: AbortSignal.timeout(3000) }
      );
      
      if (!response.ok || !isMounted) return;
      
      const data = await response.json();
      
      // Update node status in metadata if available
      if (data.node_status && Object.keys(data.node_status).length > 0) {
        // Update our local ref
        nodeStatusRef.current = {
          ...nodeStatusRef.current,
          ...data.node_status
        };
        
        // Update nodes with status information - not storing results directly
        setNodes(currentNodes => 
          currentNodes.map(node => ({
            ...node,
            data: {
              ...node.data,
              status: data.node_status[node.id] || node.data.status,
              // Pass function to get results instead of storing directly
              getNodeResult: () => nodeResultsRef.current[node.id]
            }
          }))
        );
        
        // Update the last status update time
        setLastStatusUpdate(new Date());
        
        // Also update metadata if provided
        if (setMetadata) {
          setMetadata(prev => ({
            ...prev,
            nodeStatus: {
              ...(prev.nodeStatus || {}),
              ...data.node_status
            }
          }));
        }
        
        console.log('Updated node status from API:', Object.keys(data.node_status).length, 'nodes');
      }
      
      // Also check for node results - new endpoint to get real-time results
      try {
        const resultsResponse = await fetch(
          `http://localhost:${metadata.port}/node-results/${metadata.executionId}`,
          { signal: AbortSignal.timeout(3000) }
        );
        
        if (resultsResponse.ok && isMounted) {
          const resultsData = await resultsResponse.json();
          
          if (resultsData.results && Object.keys(resultsData.results).length > 0) {
            // Update our local ref - this is where results are stored
            nodeResultsRef.current = {
              ...nodeResultsRef.current,
              ...resultsData.results
            };
            
            // Update nodes to provide access to results, but don't store directly
            setNodes(currentNodes => 
              currentNodes.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  // Ensure getNodeResult function stays updated
                  getNodeResult: () => nodeResultsRef.current[node.id]
                }
              }))
            );
            
            // Also update metadata if provided
            if (setMetadata) {
              setMetadata(prev => ({
                ...prev,
                executionResult: {
                  ...(prev.executionResult || {}),
                  results: {
                    ...(prev.executionResult?.results || {}),
                    ...resultsData.results
                  }
                }
              }));
            }
            
            console.log('Updated node results from API:', Object.keys(resultsData.results).length, 'nodes');
          }
        }
      } catch (resultError) {
        // Silently handle result check errors
        console.debug('Node results check error:', resultError);
      }
    } catch (error) {
      // Silently handle status check errors
      console.debug('Node status check error:', error);
    }
  };
  
  // Immediately check once
  checkNodeStatus();
  
  // Then set up interval for continuous updates
  statusCheckInterval = setInterval(checkNodeStatus, 2000);
  
  return () => {
    isMounted = false;
    if (statusCheckInterval) clearInterval(statusCheckInterval);
  };
}, [metadata?.executionId, metadata?.port, metadata?.executionStatus, setMetadata, setNodes]);

// Parse execution outputs for node status information and results
useEffect(() => {
  if (!metadata?.outputs || metadata.outputs.length === 0) return;
  
  // Look for any execution outputs in metadata
  const executionOutputs = metadata.outputs.filter(output => 
    output.contents.some(content => 
      typeof content.value === 'string' && (
        content.value.includes('Execution completed:') || 
        content.value.includes('Execution failed:') ||
        content.value.includes('Execution progress:')
      )
    )
  );
  
  if (executionOutputs.length > 0) {
    // Get the latest execution output
    const latestOutput = executionOutputs[executionOutputs.length - 1];
    
    try {
      // Find the content with execution data
      const resultContent = latestOutput.contents.find(content => 
        typeof content.value === 'string' && (
          content.value.includes('Execution completed:') || 
          content.value.includes('Execution failed:') ||
          content.value.includes('Execution progress:')
        )
      );
      
      if (resultContent && typeof resultContent.value === 'string') {
        // Extract JSON from the content
        const jsonStart = resultContent.value.indexOf('{');
        if (jsonStart !== -1) {
          const jsonString = resultContent.value.substring(jsonStart);
          const executionResult = JSON.parse(jsonString);
          
          // Update node statuses if available
          if (executionResult.result && executionResult.result.node_status) {
            // Update our local ref
            nodeStatusRef.current = {
              ...nodeStatusRef.current,
              ...executionResult.result.node_status
            };
            
            // Update nodes with status but not results directly
            setNodes(currentNodes => 
              currentNodes.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  status: executionResult.result.node_status[node.id] || node.data.status,
                  // Provide function to get results
                  getNodeResult: () => nodeResultsRef.current[node.id]
                }
              }))
            );
            
            // Update the last status update time
            setLastStatusUpdate(new Date());
            
            // Update metadata if setMetadata is provided
            if (setMetadata) {
              setMetadata(prev => ({
                ...prev,
                nodeStatus: {
                  ...(prev.nodeStatus || {}),
                  ...executionResult.result.node_status
                },
                executionResult: executionResult.result // Store the full result
              }));
            }
          }
          
          // Handle node results - store in ref, not in node data directly
          if (executionResult.result && executionResult.result.results) {
            // Update our local ref
            nodeResultsRef.current = {
              ...nodeResultsRef.current,
              ...executionResult.result.results
            };
            
            // Update nodes to provide access to results, but don't store directly
            setNodes(currentNodes => 
              currentNodes.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  // Ensure getNodeResult function stays updated
                  getNodeResult: () => nodeResultsRef.current[node.id]
                }
              }))
            );
            
            console.log('Updated nodes to access execution results:', 
              Object.keys(executionResult.result.results).length, 'nodes');
          }
          
          // Also handle in-progress status updates
          if (executionResult.progress && executionResult.progress.node_status) {
            // Update our local ref
            nodeStatusRef.current = {
              ...nodeStatusRef.current,
              ...executionResult.progress.node_status
            };
            
            // Update nodes with status information only
            setNodes(currentNodes => 
              currentNodes.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  status: executionResult.progress.node_status[node.id] || node.data.status,
                  // Ensure getNodeResult function stays updated
                  getNodeResult: () => nodeResultsRef.current[node.id]
                }
              }))
            );
            
            // Update metadata if setMetadata is provided
            if (setMetadata) {
              setMetadata(prev => ({
                ...prev,
                nodeStatus: {
                  ...(prev.nodeStatus || {}),
                  ...executionResult.progress.node_status
                }
              }));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing execution result:', error);
      // Silently handle error, but log it for debugging
    }
  }
}, [metadata?.outputs, setMetadata, setNodes]);

// Initialize flow from initialLayout or content
useEffect(() => {
  // If we have initialLayout, use that first
  if (initialLayout && initialLayout.nodes && initialLayout.nodes.length > 0) {
    console.log("Initializing flow from stored layout:", initialLayout);
    
    // Process nodes to ensure no results are stored directly in node data
    const processedNodes = initialLayout.nodes.map(node => ({
      ...node,
      data: {
        ...Object.entries(node.data)
          .filter(([key]) => !EXECUTION_PROPERTIES.includes(key))
          .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
        // Add function to get node result
        getNodeResult: () => nodeResultsRef.current[node.id] || 
                           metadata?.executionResult?.results?.[node.id]
      }
    }));
    
    setNodes(processedNodes);
    setEdges(initialLayout.edges);
    
    // Update previousNodesRef for consistency - without result data
    initialLayout.nodes.forEach(node => {
      const { result, executionResponse, status, ...filteredData } = node.data;
      
      previousNodesRef.current[node.id] = {
        id: node.id,
        label: filteredData.label || node.id,
        position_x: node.position.x,
        position_y: node.position.y,
        type: filteredData.type || 'process',
        ...filteredData,
        _originalProperties: ['id', 'label', 'position_x', 'position_y', 'type']
          .concat(Object.keys(filteredData)
            .filter(key => !['id', 'label', 'position_x', 'position_y', 'type'].includes(key) && 
                    !EXECUTION_PROPERTIES.includes(key)))
      };
    });
    
    // Reset unsaved changes flag since we just loaded
    setHasUnsavedChanges(false);
    return;
  }
  
  // Otherwise parse from content
  if (!content || content === previousContentRef.current) return;
  console.log("Initializing flow from content:", content.substring(0, 100) + "...");
  previousContentRef.current = content;
  
  try {
    // Parse the content and store it for reference
    const workflow = parseIncrementalContent(content, previousNodesRef.current);
    previousNodesRef.current = workflow.nodes;
    
    // Store original parsed sections for later reference when saving
    originalSectionsRef.current = workflow;
    
    const flowNodes = Object.entries(workflow.nodes).map(([id, node]: [string, any]): Node => ({
      id,
      type: 'baseNode',
      position: { 
        x: typeof node.position_x === 'number' ? node.position_x : 0, 
        y: typeof node.position_y === 'number' ? node.position_y : 0 
      },
      data: { 
        // Include all node properties except execution data
        ...Object.entries(node)
          .filter(([key]) => !EXECUTION_PROPERTIES.includes(key) && !key.startsWith('_'))
          .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}),
        // Add function to get node result rather than storing directly
        getNodeResult: () => nodeResultsRef.current[id] || metadata?.executionResult?.results?.[id],
        // Add status information separately
        status: metadata?.nodeStatus?.[id] || nodeStatusRef.current[id],
        // Override specific properties that need special handling
        label: node.label || id,
        nodeKind: determineNodeKind({id, ...node}, workflow),
        type: node.type || 'process',
        // Include these property lists for structure preservation
        _originalProperties: (node._originalProperties || [])
          .filter(prop => !EXECUTION_PROPERTIES.includes(prop)),
        _originalStructure: node._originalStructure || null
      }
    }));
  
    const flowEdges = workflow.edges.map((edge: any, index: number): Edge => ({
      id: `e${index}`,
      source: edge.source,
      target: edge.target,
      type: 'custom',
      data: {
        isBackward: parseInt(edge.target.split('-')[1] || '0') < 
                  parseInt(edge.source.split('-')[1] || '0')
      }
    }));
  
    console.log("Setting flow data:", { nodes: flowNodes.length, edges: flowEdges.length });
    setNodes(flowNodes);
    setEdges(flowEdges);
  
    // Fit view if instance exists
    if (reactFlowInstance) {
      setTimeout(() => {
        reactFlowInstance.fitView({
          padding: 0.4,
          minZoom: 0.1,
          maxZoom: 2,
          duration: 300
        });
      }, 100);
    }
    
    // Reset unsaved changes flag since we just loaded
    setHasUnsavedChanges(false);
  } catch (error) {
    console.error('Failed to parse ACT content:', error);
    toast.error('Failed to parse workflow content');
  }
}, [content, initialLayout, setNodes, setEdges, reactFlowInstance, metadata?.nodeStatus, metadata?.executionResult?.results]);

const nodeTypes = useMemo<NodeTypes>(() => ({
  baseNode: (props: any) => (
    <BaseNode
      {...props}
      icon={<Box />}
      onNodeDataChange={handleNodeDataChange}
      onNodeDelete={handleNodeDelete}
      // Pass the function to get node result
      getNodeResult={() => nodeResultsRef.current[props.id] || 
                        metadata?.executionResult?.results?.[props.id]}
    />
  ),
}), [handleNodeDataChange, handleNodeDelete, metadata?.executionResult?.results]);

// Memoize edge types
const edgeTypes = useMemo<EdgeTypes>(() => ({
  custom: CustomEdge,
}), []);

return (
  <div className="w-full h-full relative">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onInit={setReactFlowInstance}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      minZoom={0.1}
      maxZoom={2}
      defaultViewport={defaultViewport}
      fitView
      fitViewOptions={{
        padding: 0.5,
        minZoom: 0.5,
        maxZoom: 2
      }}
      panOnDrag={true}
      snapToGrid={true}
      snapGrid={[15, 15]}
    >
      <Background
        color="#5b5b5b"
        gap={20}
        style={{ backgroundColor: '#09090b' }}
      />
      <Controls />
      <MiniMap 
        zoomable 
        pannable
        nodeColor={node => {
          // First check if we have status info for this node
          const nodeStatusInfo = node.data?.status || 
                                (metadata?.nodeStatus && metadata.nodeStatus[node.id]) ||
                                (nodeStatusRef.current && nodeStatusRef.current[node.id]);
          
          if (nodeStatusInfo) {
            // Use status-based coloring with more granular states
            const status = typeof nodeStatusInfo === 'string' ? nodeStatusInfo : nodeStatusInfo.status;
            
            switch (status) {
              case 'completed':
                return '#86efac'; // Green for completed
              case 'failed':
                return '#f87171'; // Red for failed
              case 'pending':
                return '#93c5fd'; // Light blue for pending
              case 'in_progress':
                return '#fcd34d'; // Yellow for in progress
              case 'waiting':
                return '#cbd5e1'; // Slate for waiting
              case 'skipped':
                return '#a3a3a3'; // Gray for skipped
              default:
                return '#e5e7eb'; // Default gray
            }
          }
          
          // Fall back to kind-based coloring
          switch (node.data?.nodeKind) {
            case 'Input': return '#93c5fd';
            case 'Output': return '#86efac';
            case 'Core': return '#c084fc';
            default: return '#e5e7eb';
          }
        }}
      />
      
      <Panel position="top-right" className="z-10">
        {status === 'updating' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-md text-sm flex items-center">
            <span>Saving changes...</span>
          </div>
        )}
        
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-md text-sm flex items-center">
            <span>Error saving changes</span>
          </div>
        )}
  
        {metadata?.executionStatus === 'running' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm flex items-center mt-2">
            <span>Execution in progress...</span>
          </div>
        )}
      </Panel>
    </ReactFlow>
    
    {/* Action buttons */}
    <div className="absolute bottom-4 right-4 flex gap-2 z-10">
      <Button 
        onClick={onAddNode}
        className="bg-blue-600 hover:bg-blue-700"
      >
        Add Node
      </Button>
      <Button 
        onClick={() => saveFlowToContent(false)} // explicit save, not debounced
        className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
        disabled={!hasUnsavedChanges || savingNodesRef.current || status === 'updating'}
      >
        <Save size={16} />
        Save Flow
      </Button>
    </div>
    
    {/* Debug info panel */}
    <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white text-xs p-2 rounded z-20">
      <div>Nodes: {nodes.length} | Edges: {edges.length}</div>
      <div>Has unsaved changes: {hasUnsavedChanges ? 'Yes' : 'No'}</div>
      <div>Status: {status}</div>
      <div>Execution: {metadata?.executionStatus || 'none'}</div>
      {lastSavedTime && <div>Last saved: {lastSavedTime.toLocaleTimeString()}</div>}
      {lastStatusUpdate && <div>Last status update: {lastStatusUpdate.toLocaleTimeString()}</div>}
      <div>Nodes with results: {Object.keys(nodeResultsRef.current).length}</div>
    </div>
    
    {/* Unsaved changes indicator */}
    {hasUnsavedChanges && status !== 'updating' && (
      <div className="absolute top-4 right-4 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-md text-sm flex items-center z-10">
        <span>Unsaved changes</span>
      </div>
    )}
    
    {/* Enhanced Status Legend with more states */}
    {(metadata?.nodeStatus && Object.keys(metadata.nodeStatus).length > 0) || 
     (nodeStatusRef.current && Object.keys(nodeStatusRef.current).length > 0) ? (
      <div className="absolute bottom-4 left-4 bg-white border border-slate-200 rounded-md shadow-sm p-2 z-10">
        <div className="text-xs font-semibold mb-1">Node Status</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span>Failed</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span>Waiting</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span>Skipped</span>
          </div>
        </div>
      </div>
    ) : null}
  </div>
);
};

export default ActFlowVisualizer;