'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import React, { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import BaseNode from './../../components/BaseNode'; // Import the BaseNode component

// Custom theme to enhance edge highlighting and other elements
const customTheme = EditorView.theme({
  // Core styling
  "&": { 
    backgroundColor: "#1e1e1e",
    height: "100%"
  },
  ".cm-content": { 
    padding: "10px 0",
    fontFamily: "'Fira Code', monospace",
    fontSize: "14px"
  },
  ".cm-line": {
    padding: "0 4px"
  },
  
  // General syntax styling
  ".cm-string": { color: "#ce9178" },
  ".cm-number": { color: "#b5cea8" },
  ".cm-keyword": { color: "#569cd6", fontWeight: "bold" },
  ".cm-property": { color: "#9cdcfe" },
  ".cm-comment": { color: "#6a9955", fontStyle: "italic" },
  ".cm-operator": { color: "#d4d4d4" },
  ".cm-punctuation": { color: "#d4d4d4" },
  
  // Special styling for brackets to make section headers stand out
  ".cm-bracket": { color: "#569cd6", fontWeight: "bold" }
});

// Define node types outside components to avoid recreation
const nodeTypes = {
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
function isActContent(content) {
  if (!content) return false;
  
  // Check for ACT format indicators:
  // 1. Contains [workflow] section
  // 2. Contains [node:something] pattern
  // 3. Contains [edges] section
  const hasWorkflowSection = content.includes('[workflow]');
  const hasNodePattern = /\[node:[^\]]+\]/.test(content);
  const hasEdgesSection = content.includes('[edges]');
  
  return hasWorkflowSection && (hasNodePattern || hasEdgesSection);
}

// Parse workflow string to ReactFlow format
function parseWorkflow(content) {
  if (!content) return { workflow: {}, nodes: [], edges: [], env: {} };
  
  // Check if this is valid ACT content
  if (!isActContent(content)) {
    console.warn('Content does not appear to be in ACT format');
    return { workflow: {}, nodes: [], edges: [], env: {}, isValid: false };
  }
  
  // Object to store all parsed nodes with proper params
  const processedNodes = {};
  
  const lines = content.split('\n');
  const workflow = {};
  let currentSection = null;
  let nodes = {};
  let edges = {};
  let env = {};
  let edgesRaw = {};

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
          id: currentSection
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
          // Keep as string if not valid JSON
        }
      }
      
      // Special handling for params key
      if (trimmedKey === 'params' && typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Create an empty object if params is a string and can't be parsed
          value = {};
          console.warn('Params could not be parsed, using empty object instead');
        }
      }
      
      // Try to parse numbers
      if (!isNaN(value) && !value.startsWith('"') && value !== '') {
        value = Number(value);
      }
      
      // Store in appropriate section
      if (currentSection === 'workflow') {
        workflow[trimmedKey] = value;
      } else if (currentSection === 'edges') {
        edges[trimmedKey] = value;
        edgesRaw[trimmedKey] = value; // Keep the raw edges
      } else if (currentSection === 'env') {
        env[trimmedKey] = value;
      } else if (nodes[currentSection]) {
        // Special handling for params field
        if (trimmedKey === 'params') {
          // Ensure params is always an object
          if (typeof value === 'string') {
            try {
              nodes[currentSection][trimmedKey] = JSON.parse(value);
            } catch (e) {
              // If params is a string that can't be parsed, use empty object
              nodes[currentSection][trimmedKey] = {};
              console.warn(`Could not parse params for node ${currentSection}, using empty object`);
            }
          } else {
            nodes[currentSection][trimmedKey] = value;
          }
        } else {
          nodes[currentSection][trimmedKey] = value;
        }
      }
    }
  }
  
  // Add a start node if referenced but not defined
  if (workflow.start_node && !nodes[workflow.start_node]) {
    nodes[workflow.start_node] = {
      id: workflow.start_node,
      type: 'start',
      label: 'Start',
      position_x: 250,
      position_y: 50
    };
  }
  
  // Convert edges to ReactFlow format
  const reactFlowEdges = [];
  for (const [source, target] of Object.entries(edges)) {
    // Skip edges with non-existent nodes
    if (!nodes[source] || !nodes[target]) continue;
    
    reactFlowEdges.push({
      id: `e-${source}-${target}`,
      source,
      target,
      sourceHandle: null,
      targetHandle: null,
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
  Object.values(nodes).forEach(node => {
    // Clone node to avoid modifying original
    const processedNode = { ...node };
    
    // Ensure params is an object
    if (typeof processedNode.params === 'string') {
      try {
        processedNode.params = JSON.parse(processedNode.params);
      } catch (e) {
        processedNode.params = {};
      }
    } else if (!processedNode.params) {
      processedNode.params = {};
    }
    
    // Store processed node
    processedNodes[node.id] = processedNode;
  });
  
  // Convert nodes to ReactFlow format
  const reactFlowNodes = Object.values(processedNodes).map(node => {
    // If this is a start node, make sure the type is 'start'
    if (node.id === workflow.start_node) {
      node.type = 'start';
    }
    
    return {
      id: node.id,
      type: node.type || 'default',
      data: { 
        label: node.label || node.id,
        operation: node.operation || '',
        operation_name: node.operation_name || '',
        // Always ensure params is an object
        params: typeof node.params === 'object' ? node.params : {},
        ...node
      },
      position: { 
        x: parseInt(node.position_x) || 0, 
        y: parseInt(node.position_y) || 0 
      }
    };
  });
  
  return {
    workflow,
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    env,
    edgesRaw
  };
}

// Convert ReactFlow data back to workflow format
// Optimized code generation with better performance
function generateWorkflowCode(workflow, nodes, edges, env, edgesRaw = {}) {
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
    
    // Add fundamental properties first
    if (node.data.type && node.data.type !== 'default' && node.data.type !== 'start') {
      nodeChunks.push(`type = "${node.data.type}"\n`);
    }
    if (node.data.label) nodeChunks.push(`label = "${node.data.label}"\n`);
    
    // Add position
    nodeChunks.push(`position_x = ${Math.round(node.position.x)}\n`);
    nodeChunks.push(`position_y = ${Math.round(node.position.y)}\n`);
    
    // Filter properties to only include what's needed
    const relevantProps = Object.entries(nodeData).filter(([key, value]) => {
      return !(['id', 'type', 'label', 'position_x', 'position_y'].includes(key)) 
        && value !== undefined && value !== null;
    });
    
    // Add other properties
    relevantProps.forEach(([key, value]) => {
      if (key === 'params') {
        // Always ensure params is an object
        const paramsValue = typeof value === 'object' ? value : 
                            typeof value === 'string' ? ((() => {
                              try { return JSON.parse(value); } catch (e) { return {}; }
                            })()) : {};
        nodeChunks.push(`params = ${JSON.stringify(paramsValue)}\n`);
      } else if (typeof value === 'string') {
        nodeChunks.push(`${key} = "${value}"\n`);
      } else {
        nodeChunks.push(`${key} = ${value}\n`);
      }
    });
    
    const nodeSection = nodeChunks.join('');
    nodeProps.set(nodeKey, nodeSection);
    codeChunks.push(nodeSection);
  });
  
  // Add edges section
  codeChunks.push('\n[edges]\n');
  
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
}

// FlowEditor component with BaseNode integration
function FlowEditor({ nodes: initialNodes, edges: initialEdges, workflow, env, edgesRaw, onSave }) {
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

  // Handle edge connections
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
    }, eds));
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

  return (
    <ReactFlow
      nodes={nodesWithHandlers}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
    >
      <Background variant="dots" gap={12} size={1} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

// FlowWrapper Component
const FlowWrapper = memo(({ nodes, edges, workflow, env, edgesRaw, onSave }) => {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <FlowEditor
          nodes={nodes}
          edges={edges}
          workflow={workflow}
          env={env}
          edgesRaw={edgesRaw}
          onSave={onSave}
        />
      </div>
    </ReactFlowProvider>
  );
});

// Prevent unnecessary rerenders
FlowWrapper.displayName = 'FlowWrapper';

function PureCodeEditor({ content, onSaveContent, status = 'idle', isCurrentVersion = true, currentVersionIndex = 0, suggestions = [] }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const flowContainerRef = useRef(null);
  const [isFlowView, setIsFlowView] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [ignoreSave, setIgnoreSave] = useState(false);
  const [isValidActContent, setIsValidActContent] = useState(true);
  const lastUpdateRef = useRef('');

  // Initialize the flowData state - optimized with debouncing
  useEffect(() => {
    if (!ignoreSave && content) {
      // Skip if content hasn't changed
      if (content === lastUpdateRef.current) return;
      
      // Check if content is valid ACT format
      const isValid = isActContent(content);
      setIsValidActContent(isValid);
      
      // Use requestIdleCallback if available for non-critical updates
      const updateParsedData = () => {
        try {
          lastUpdateRef.current = content;
          if (isValid) {
            const parsed = parseWorkflow(content);
            setParsedData(parsed);
          } else {
            console.warn('Content is not in ACT format, disabling flow view');
            setParsedData(null);
            // If in flow view but content is invalid, switch to code view
            if (isFlowView) {
              setIsFlowView(false);
            }
          }
        } catch (error) {
          console.error('Error parsing workflow:', error);
          setIsValidActContent(false);
        }
      };
      
      if (window.requestIdleCallback) {
        window.requestIdleCallback(updateParsedData, { timeout: 300 });
      } else {
        setTimeout(updateParsedData, 1);
      }
    }
  }, [content, ignoreSave, isFlowView]);

  // Initialize or update the editor
  useEffect(() => {
    if (containerRef.current && !editorRef.current && !isFlowView) {
      // Use JSON mode as it provides some reasonable coloring for ACT-like content
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup, 
          json(),
          oneDark,
          customTheme
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [isFlowView, content]);

  // Setup editor update listener
  useEffect(() => {
    if (editorRef.current && !isFlowView) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            if (!ignoreSave) {
              lastUpdateRef.current = newContent;
              onSaveContent(newContent, true);
            }
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup, 
          json(),
          oneDark, 
          customTheme,
          updateListener
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent, isFlowView, ignoreSave]);

  // Update editor content when it changes externally
  useEffect(() => {
    if (editorRef.current && content && !isFlowView) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === 'streaming' || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status, isFlowView]);

  // Handle saving flow changes back to code - optimized
  const handleFlowSave = useCallback((newCode) => {
    if (newCode === lastUpdateRef.current) return;
    
    // Use RAF to batch updates with browser rendering cycle
    requestAnimationFrame(() => {
      setIgnoreSave(true);
      lastUpdateRef.current = newCode;
      onSaveContent(newCode, true);
      
      // Reset ignore flag after a shorter delay
      setTimeout(() => {
        setIgnoreSave(false);
      }, 200);
    });
  }, [onSaveContent]);

  // Toggle between views
  const handleToggleView = useCallback(() => {
    setIsFlowView(!isFlowView);
  }, [isFlowView]);

  return (
    <div className="relative not-prose w-full h-full" style={{ minHeight: '80vh' }}>
      <div className="absolute top-2 right-2 z-10">
        <button 
          onClick={handleToggleView}
          className={`px-4 py-2 ${isValidActContent ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
          disabled={!isValidActContent}
          title={!isValidActContent ? "Content is not in ACT format" : ""}
        >
          {isFlowView ? 'Show Code View' : 'Show Flow View'}
        </button>
      </div>
      
      {isFlowView ? (
        <div 
          ref={flowContainerRef}
          className="w-full h-[80vh]" 
          style={{ height: '80vh', width: '100%' }}
        >
          {parsedData && (
            <FlowWrapper 
              nodes={parsedData.nodes}
              edges={parsedData.edges}
              workflow={parsedData.workflow}
              env={parsedData.env}
              edgesRaw={parsedData.edgesRaw}
              onSave={handleFlowSave}
            />
          )}
        </div>
      ) : (
        <div
          className="w-full pb-[calc(80dvh)] text-sm"
          ref={containerRef}
        />
      )}
    </div>
  );
}

function areEqual(prevProps, nextProps) {
  if (prevProps.suggestions !== nextProps.suggestions) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
  if (prevProps.status === 'streaming' && nextProps.status === 'streaming')
    return false;
  if (prevProps.content !== nextProps.content) return false;

  return true;
}

const CodeEditor = memo(PureCodeEditor, areEqual);

export default CodeEditor;