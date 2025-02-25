'use client';

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

function parseIncrementalContent(content: string, previousNodes = {}) {
  const sections: Record<string, any> = {
    workflow: { start_node: '' },
    nodes: { ...previousNodes },
    edges: []
  };
  
  const lines = content.split('\n').map(line => line.trim());
  let currentSection = '';
  
  for (const line of lines) {
    if (line === '' || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1);
      if (currentSection.startsWith('node:')) {
        const nodeId = currentSection.split(':')[1];
        if (!sections.nodes[nodeId]) {
          sections.nodes[nodeId] = {
            id: nodeId,
            label: nodeId,
            position_x: sections.nodes[nodeId]?.position_x || Math.random() * 500,
            position_y: sections.nodes[nodeId]?.position_y || Math.random() * 500,
            node_type: 'APP NAME'
          };
        }
      }
      continue;
    }

    if (line.includes('=')) {
      const [key, value] = line.split('=').map(part => part.trim());
      let parsedValue = value;
      
      try {
        if (value.startsWith('{')) parsedValue = JSON.parse(value);
        else if (value.startsWith('"')) parsedValue = value.slice(1, -1);
        else if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
      } catch (e) {}

      if (currentSection.startsWith('node:')) {
        const nodeId = currentSection.split(':')[1];
        sections.nodes[nodeId][key] = parsedValue;
      } else if (currentSection === 'edges') {
        sections.edges.push({
          source: key,
          target: typeof parsedValue === 'string' ? 
            parsedValue.replace(/['"]/g, '') : 
            String(parsedValue)
        });
      } else if (currentSection === 'workflow') {
        sections.workflow[key] = parsedValue;
      }
    }
  }

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

function getActContentFromFlow(nodes: Node[], edges: Edge[]): string {
  let content = '[workflow]\nstart_node=""\n\n';
  
  // Add nodes with precise position values
  nodes.forEach(node => {
    content += `[node:${node.id}]\n`;
    content += `label="${node.data.label || node.id}"\n`;
    content += `node_type="${node.data.nodeType || 'default'}"\n`;
    
    // Use precise position values
    content += `position_x=${node.position.x}\n`;
    content += `position_y=${node.position.y}\n`;
    
    // Add any other node properties
    if (node.data.operation) content += `operation="${node.data.operation}"\n`;
    if (node.data.operation_name) content += `operation_name="${node.data.operation_name}"\n`;
    if (node.data.formData && Object.keys(node.data.formData).length > 0) {
      content += `form_data=${JSON.stringify(node.data.formData)}\n`;
    }
    
    // Add all other custom properties from the node data
    Object.entries(node.data).forEach(([key, value]) => {
      // Skip already handled properties and internal React Flow properties
      if (['label', 'nodeType', 'operation', 'operation_name', 'formData', '__reactFlow', 'nodeKind'].includes(key)) {
        return;
      }
      
      // Add the property with appropriate formatting
      if (typeof value === 'string') {
        content += `${key}="${value}"\n`;
      } else if (typeof value === 'object' && value !== null) {
        content += `${key}=${JSON.stringify(value)}\n`;
      } else if (value !== undefined && value !== null) {
        content += `${key}=${value}\n`;
      }
    });
    
    content += '\n';
  });

  // Add edges
  if (edges.length > 0) {
    content += '[edges]\n';
    edges.forEach(edge => {
      content += `${edge.source}="${edge.target}"\n`;
    });
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
  
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
    onLayoutChangeRef.current = onLayoutChange;
  }, [onContentChange, onLayoutChange]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previousNodesRef = useRef<Record<string, any>>({});
  const previousContentRef = useRef<string>('');
  const savingNodesRef = useRef(false);
  
  // Debug info
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

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
      
      const updatedContent = getActContentFromFlow(currentNodes, currentEdges);
      
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
            
            // Also update any additional properties from node.data that should be preserved
            Object.entries(node.data).forEach(([key, value]) => {
              if (key !== 'id' && key !== 'position' && key !== '__reactFlow') {
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
        nodeKind: 'Default',
        nodeType: 'default',
        workflowId: 'unknown',
        formData: {},
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
      node_type: 'default'
    };
    
    setHasUnsavedChanges(true);
  }, [setNodes, generateNodeId]);

  // Handle node data changes from BaseNode component
  const handleNodeDataChange = useCallback((id: string, newData: any) => {
    console.log("Node data changed:", id, newData);
    
    setNodes(nds => 
      nds.map(node => 
        node.id === id 
          ? { ...node, data: { ...node.data, ...newData } } 
          : node
      )
    );
    
    // Update previousNodesRef for consistency
    if (previousNodesRef.current[id]) {
      Object.entries(newData).forEach(([key, value]) => {
        previousNodesRef.current[id][key] = value;
      });
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
    
    setHasUnsavedChanges(true);
  }, [setNodes, setEdges]);

  // Initialize flow from initialLayout or content
  useEffect(() => {
    // If we have initialLayout, use that first
    if (initialLayout && initialLayout.nodes && initialLayout.nodes.length > 0) {
      console.log("Initializing flow from stored layout:", initialLayout);
      
      setNodes(initialLayout.nodes);
      setEdges(initialLayout.edges);
      
      // Update previousNodesRef for consistency
      initialLayout.nodes.forEach(node => {
        previousNodesRef.current[node.id] = {
          id: node.id,
          label: node.data.label || node.id,
          position_x: node.position.x,
          position_y: node.position.y,
          node_type: node.data.nodeType || 'default'
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
      const workflow = parseIncrementalContent(content, previousNodesRef.current);
      previousNodesRef.current = workflow.nodes;
      
      const flowNodes = Object.entries(workflow.nodes).map(([id, node]: [string, any]): Node => ({
        id,
        type: 'baseNode',
        position: { 
          x: typeof node.position_x === 'number' ? node.position_x : 0, 
          y: typeof node.position_y === 'number' ? node.position_y : 0 
        },
        data: { 
          label: node.label || id,
          operation: node.operation,
          operation_name: node.operation_name,
          nodeKind: determineNodeKind({id, ...node}, workflow),
          nodeType: node.node_type || 'default',
          workflowId: workflow.workflow?.id || 'unknown',
          formData: node.form_data || {},
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
  }, [content, initialLayout, setNodes, setEdges, reactFlowInstance]);

  const nodeTypes = useMemo<NodeTypes>(() => ({
  baseNode: (props: any) => (
    <BaseNode
      {...props}
      icon={<Box />}
      onNodeDataChange={handleNodeDataChange}
      onNodeDelete={handleNodeDelete}
    />
  ),
}), [handleNodeDataChange, handleNodeDelete]);
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
        <Background />
        <Controls />
        <MiniMap 
          zoomable 
          pannable
          nodeColor={node => {
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
        {lastSavedTime && <div>Last saved: {lastSavedTime.toLocaleTimeString()}</div>}
      </div>
      
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && status !== 'updating' && (
        <div className="absolute top-4 right-4 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-md text-sm flex items-center z-10">
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  );
};

export default ActFlowVisualizer;