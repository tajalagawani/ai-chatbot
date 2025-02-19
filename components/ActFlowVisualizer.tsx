// components/ActFlowVisualizer.tsx
import { useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Console } from './console';

// Helper to parse ACT content from string format
function parseActContent(content: string) {
  try {
    let currentSection = '';
    const sections: Record<string, any> = {
      workflow: {
        start_node: ''
      },
      nodes: {},
      edges: []
    };
    
    const lines = content.split('\n').map(line => line.trim());
    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1);
        if (currentSection.startsWith('node:')) {
          const nodeId = currentSection.split(':')[1];
          // Initialize node with its ID
          sections.nodes[nodeId] = {
            id: nodeId,
            label: nodeId,
            position_x: 0,
            position_y: 0,
            node_type: 'APP NAME'
          };
        }
        continue;
      }

      if (line.includes('=')) {
        const [key, value] = line.split('=').map(part => part.trim());
        try {
          let parsedValue;
          if (value.startsWith('{') && value.endsWith('}')) {
            try {
              parsedValue = JSON.parse(value);
            } catch {
              parsedValue = value;
            }
          } else if (value.startsWith('"') && value.endsWith('"')) {
            parsedValue = value.slice(1, -1);
          } else if (value === 'true') {
            parsedValue = true;
          } else if (value === 'false') {
            parsedValue = false;
          } else if (!isNaN(Number(value))) {
            parsedValue = Number(value);
          } else {
            parsedValue = value;
          }
          
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
            // For start_node
            sections.workflow[key] = parsedValue;
          }
        } catch (error) {
          console.error(`Error parsing value in line: ${line}`, error);
        }
      }
    }
    
    return sections;
  } catch (error) {
    console.error('Failed to parse ACT content:', error);
    return {
      workflow: { start_node: '' },
      nodes: {},
      edges: []
    };
  }
}

// Helper to convert parsed ACT content to ReactFlow elements
function convertToReactFlowElements(workflow: any) {
  if (!workflow || typeof workflow !== 'object') {
    return { nodes: [], edges: [] };
  }

  const nodes: Node[] = Object.entries(workflow.nodes || {}).map(([id, node]: [string, any]) => ({
    id,
    type: 'default',
    position: { 
      x: parseInt(node.position_x) || 0, 
      y: parseInt(node.position_y) || 0 
    },
    data: { 
      label: node.label || id,
      operation: node.operation,
      operation_name: node.operation_name
    },
    style: {
      background: '#1a1f2a',
      border: '1px solid #304050',
      padding: 10,
      borderRadius: 5,
      color: '#fff'
    }
  }));

  let edgesArray: Array<{source: string, target: string}> = [];
  
  if (workflow.edges) {
    if (Array.isArray(workflow.edges)) {
      edgesArray = workflow.edges;
    } else if (typeof workflow.edges === 'object') {
      edgesArray = Object.entries(workflow.edges).map(([source, target]) => ({
        source,
        target: typeof target === 'string' ? target : String(target)
      }));
    }
  }

  const edges: Edge[] = edgesArray.map((edge, index) => ({
    id: `e${index}`,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#304050' }
  }));

  return { nodes, edges };
}

// Function to detect if content is ACT format
export function isActContent(content: string): boolean {
  if (!content) return false;
  
  // Check for specific ACT markers
  return (
    content.includes('[workflow]') || 
    content.includes('[node:') ||
    (content.includes('start_node') && content.includes('operation'))
  );
}

interface ActFlowVisualizerProps {
  content: string;
  isStreaming: boolean;
  metadata: any;
  setMetadata: (metadata: any) => void;
}

export const ActFlowVisualizer = ({ 
  content, 
  isStreaming,
  metadata,
  setMetadata
}: ActFlowVisualizerProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [lastCompleteContent, setLastCompleteContent] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const fitViewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store the last complete content when not streaming
  useEffect(() => {
    if (!isStreaming && content && isActContent(content)) {
      setLastCompleteContent(content);
    }
  }, [isStreaming, content]);

  // Update flow nodes when content changes
  useEffect(() => {
    // Use last complete content during streaming
    const contentToUse = isStreaming && lastCompleteContent 
      ? lastCompleteContent 
      : content;
      
    if (contentToUse && isActContent(contentToUse)) {
      try {
        // Parse the ACT content
        const parsedWorkflow = parseActContent(contentToUse);
        
        // Only render if we have actual content to show
        if (Object.keys(parsedWorkflow.nodes).length > 0) {
          // Convert to ReactFlow elements
          const { nodes: flowNodes, edges: flowEdges } = convertToReactFlowElements(parsedWorkflow);
          
          console.log(`Created ${flowNodes.length} nodes and ${flowEdges.length} edges`);
          
          // Update the flow with the parsed nodes
          setNodes(flowNodes);
          setEdges(flowEdges);
          
          // Schedule fit view after nodes are rendered
          if (fitViewTimeoutRef.current) {
            clearTimeout(fitViewTimeoutRef.current);
          }
          
          fitViewTimeoutRef.current = setTimeout(() => {
            if (reactFlowInstance) {
              console.log('Fitting view to nodes');
              reactFlowInstance.fitView({ padding: 0.2 });
            }
          }, 200);
        }
      } catch (error) {
        console.error('Failed to parse ACT content for flow view:', error);
        // Don't clear nodes if there's an error during streaming
        if (!isStreaming) {
          setNodes([]);
          setEdges([]);
        }
      }
    }
  }, [content, isStreaming, lastCompleteContent, setNodes, setEdges, reactFlowInstance]);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
    };
  }, []);

  if (isStreaming && (!lastCompleteContent || nodes.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full flex-col bg-[#0d1116]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-400">Waiting for complete ACT content...</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d1116]">
        <p className="text-gray-400">No valid workflow nodes found in content</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#0d1116]">
      <div className="flex-grow" style={{ height: metadata?.outputs?.length ? 'calc(100% - 200px)' : '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={setReactFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-[#0d1116]"
          style={{ background: '#0d1116' }}
        >
          <Background color="#304050" gap={16} />
          <Controls className="bg-gray-800 text-gray-300 fill-gray-300" />
          <MiniMap 
            style={{ 
              backgroundColor: '#1a1f2a',
             
            }} 
          />
        </ReactFlow>
      </div>

      {metadata?.outputs && metadata.outputs.length > 0 && (
        <div className="h-200px">
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default ActFlowVisualizer;