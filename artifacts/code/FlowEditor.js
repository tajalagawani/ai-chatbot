'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  MarkerType, 
  useNodesState,
  useEdgesState,
  addEdge 
} from 'reactflow';
import { nodeTypes } from './WorkflowUtils';
import { generateWorkflowCode } from './WorkflowUtils';

// FlowEditor component with BaseNode integration
export function FlowEditor({ nodes: initialNodes, edges: initialEdges, workflow, env, edgesRaw, onSave }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const timeoutRef = useRef(null);
  
  // Handle node data changes from BaseNode component
  const handleNodeDataChange = useCallback((nodeId, newData) => {
    setNodes(nds => 
      nds.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId) => {
    // Remove the node
    setNodes(nds => nds.filter(node => node.id !== nodeId));
    
    // Also remove connected edges
    setEdges(eds => eds.filter(edge => 
      edge.source !== nodeId && edge.target !== nodeId
    ));
  }, [setNodes, setEdges]);

  // Handle edge connections with explicit default handles
  const onConnect = useCallback((params) => {
    const connectionParams = {
      ...params,
      // Fix: Set explicit default handle IDs if they're undefined
      sourceHandle: params.sourceHandle || 'default',
      targetHandle: params.targetHandle || 'default',
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#555' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#555',
      }
    };
    
    setEdges((eds) => addEdge(connectionParams, eds));
  }, [setEdges]);

  // Fix existing edges with undefined handles
  useEffect(() => {
    setEdges(currentEdges => 
      currentEdges.map(edge => ({
        ...edge,
        sourceHandle: edge.sourceHandle || 'default',
        targetHandle: edge.targetHandle || 'default'
      }))
    );
  }, [setEdges]);

  // Extend nodes with additional properties - optimized to avoid unnecessary rerenders
  const nodesWithHandlers = useMemo(() => {
    // Only add handlers and references when needed
    return nodes.map(node => {
      // Skip if node already has handlers
      if (node.data.onNodeDataChange && node.data.onNodeDelete) {
        return node;
      }
      
      // Ensure params is an object
      const nodeData = { ...node.data };
      if (!nodeData.params || typeof nodeData.params !== 'object') {
        nodeData.params = {};
      }
      
      return {
        ...node,
        data: {
          ...nodeData,
          onNodeDataChange: handleNodeDataChange,
          onNodeDelete: handleNodeDelete,
          // Only provide full nodes/edges references when actually needed by node components
          allNodes: nodes.map(({ id, type, position, data: { label } }) => ({ id, type, position, data: { label } })),
          allEdges: edges.map(({ id, source, target }) => ({ id, source, target }))
        }
      };
    });
  }, [nodes, edges, handleNodeDataChange, handleNodeDelete]);

  // Memoize the generated code to avoid unnecessary calculations
  const generatedCode = useMemo(() => {
    return generateWorkflowCode(workflow, nodes, edges, env, edgesRaw);
  }, [workflow, nodes, edges, env, edgesRaw]);

  // Save changes when nodes or edges change (with optimized debounce)
  useEffect(() => {
    // Clear existing timeout to avoid multiple updates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout to save changes after a delay
    timeoutRef.current = setTimeout(() => {
      onSave(generatedCode);
    }, 300); // Reduced debounce time
    
    // Cleanup function to clear timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [generatedCode, onSave]);

  // Properly memoize nodeTypes to prevent the React Flow warning
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  // Define default edge options
  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#555' },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#555',
    },
    // Set explicit default handles
    sourceHandle: 'default',
    targetHandle: 'default'
  }), []);

  return (
    <ReactFlow
      nodes={nodesWithHandlers}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={memoizedNodeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      fitView
      fitViewOptions={{ padding: 0.2 }}
    >
      <Background variant="dots" gap={12} size={1} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

// Export a memoized version to prevent unnecessary re-renders
export default memo(FlowEditor);