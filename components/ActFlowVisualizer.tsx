import { useEffect, useRef, useState, useCallback } from 'react';
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
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useDebounceCallback } from 'usehooks-ts';
import BaseNode from './BaseNode';
import { Box } from 'lucide-react';
import CustomEdge from './CustomEdge';

interface ActFlowVisualizerProps {
  content: string;
  isStreaming: boolean;
  metadata?: any;
  setMetadata?: (metadata: any) => void;
  onContentChange?: (content: string) => void;
  saveContent?: (content: string, debounce: boolean) => void;
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
  
  // Add nodes
  nodes.forEach(node => {
    content += `[node:${node.id}]\n`;
    content += `label="${node.data.label}"\n`;
    content += `node_type="${node.data.nodeType}"\n`;
    content += `position_x=${Math.round(node.position.x)}\n`;
    content += `position_y=${Math.round(node.position.y)}\n`;
    if (node.data.operation) content += `operation="${node.data.operation}"\n`;
    if (node.data.operation_name) content += `operation_name="${node.data.operation_name}"\n`;
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
    (content.includes('start_node') && content.includes('operation'))
  );
}

const nodeTypes = {
  baseNode: (props: any) => (
    <BaseNode
      {...props}
      icon={<Box />}
      nodeKind={props.data.nodeKind}
      nodeType={props.data.nodeType}
      onNodeDataChange={(id, newData) => {
        console.log('Node data changed:', id, newData);
      }}
      onNodeDelete={(id) => {
        console.log('Node deleted:', id);
      }}
      allNodes={[]}
      allEdges={[]}
    />
  ),
};

const edgeTypes = {
  custom: CustomEdge,
};

export const ActFlowVisualizer: React.FC<ActFlowVisualizerProps> = ({ 
  content, 
  isStreaming,
  metadata,
  setMetadata,
  onContentChange,
  saveContent
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const previousNodesRef = useRef<Record<string, any>>({});
  const previousContentRef = useRef<string>('');
  const isManualChangeRef = useRef(false);

  const defaultViewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 2
  };

  const handleContentUpdate = useCallback((updatedNodes: Node[], updatedEdges: Edge[]) => {
    const updatedContent = getActContentFromFlow(updatedNodes, updatedEdges);
    if (saveContent) {
      saveContent(updatedContent, true);
    } else if (onContentChange) {
      onContentChange(updatedContent);
    }
  }, [onContentChange, saveContent]);

  const debouncedHandleContentUpdate = useDebounceCallback(handleContentUpdate, 2000);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    isManualChangeRef.current = true;
    onNodesChange(changes);
  
    const positionChanges = changes.filter(
      (change): change is NodeChange & { position: XYPosition } => 
        change.type === 'position' && 
        !change.dragging && 
        change.position !== undefined &&
        typeof change.position.x === 'number' &&
        typeof change.position.y === 'number'
    );
  
    if (positionChanges.length > 0) {
      // Update nodes with new positions
      const updatedNodes = nodes.map(node => {
        const positionChange = positionChanges.find(change => change.id === node.id);
        if (positionChange?.position) {
          if (previousNodesRef.current[node.id]) {
            previousNodesRef.current[node.id].position_x = positionChange.position.x;
            previousNodesRef.current[node.id].position_y = positionChange.position.y;
          }
          return {
            ...node,
            position: positionChange.position
          };
        }
        return node;
      });
  
      // Generate new content from updated nodes
      const updatedContent = getActContentFromFlow(updatedNodes, edges);
  
      // Save using the provided saveContent function
      if (saveContent) {
        console.log('Saving flow content:', updatedContent);
        saveContent(updatedContent, true);
      }
    }
  }, [nodes, edges, onNodesChange, saveContent]);
  
  // Handle edge changes similarly
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    
    const hasRemovals = changes.some(change => change.type === 'remove');
    if (hasRemovals) {
      const updatedEdges = edges.filter(edge => 
        !changes.some(change => 
          change.type === 'remove' && change.id === edge.id
        )
      );
      const updatedContent = getActContentFromFlow(nodes, updatedEdges);
      
      if (saveContent) {
        console.log('Saving flow content after edge change:', updatedContent);
        saveContent(updatedContent, false); // Don't debounce edge removals
      }
    }
  }, [nodes, edges, onEdgesChange, saveContent]);
  useEffect(() => {
    if (!content || content === previousContentRef.current) return;
    previousContentRef.current = content;
    isManualChangeRef.current = false;

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
          isBackward: parseInt(edge.target.split('-')[1]) < parseInt(edge.source.split('-')[1])
        }
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);

      if (reactFlowInstance) {
        reactFlowInstance.fitView({
          padding: 0.4,
          minZoom: 0.1,
          maxZoom: 2,
          duration: 300
        });
      }
    } catch (error) {
      console.error('Failed to parse ACT content:', error);
      if (setMetadata) {
        setMetadata(prev => ({
          ...prev,
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Failed to parse flow content'
        }));
      }
    }
  }, [content, setNodes, setEdges, reactFlowInstance, setMetadata]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{
          padding: 1,
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
      </ReactFlow>
    </div>
  );
};

export type { ActFlowVisualizerProps };