import { Node, Edge, NodeChange, EdgeChange } from 'reactflow';
import { useCallback, useRef, useEffect } from 'react';

interface FlowMetadata {
  isValid: boolean;
  flowData: any;
  dockerStatus?: string;
  containerStatus?: string;
  outputs?: Array<{
    id: string;
    contents: Array<{ type: string; value: string }>;
    status: string;
  }>;
}

interface UseSyncFlowProps {
  onSaveContent: (content: string, debounce: boolean) => void;
  nodes: Node[];
  edges: Edge[];
  metadata?: FlowMetadata;
  setMetadata?: (metadata: any) => void;
  isStreaming?: boolean;
}

export function useSyncFlow({ 
  onSaveContent, 
  nodes, 
  edges,
  metadata,
  setMetadata,
  isStreaming 
}: UseSyncFlowProps) {
  const flowChangesRef = useRef(false);
  const lastSavedContentRef = useRef<string>('');

  const handleFlowChange = useCallback((updatedNodes: Node[], updatedEdges: Edge[]) => {
    if (isStreaming) {
      console.warn('Ignoring flow changes while streaming');
      return;
    }

    // Set flag to prevent circular updates
    flowChangesRef.current = true;

    try {
      // Convert flow state to ACT content format
      const content = getActContentFromFlow(updatedNodes, updatedEdges);
      
      // Only save if content has actually changed
      if (content !== lastSavedContentRef.current) {
        lastSavedContentRef.current = content;
        onSaveContent(content, false);

        // Update metadata if provided
        if (setMetadata) {
          setMetadata(prev => ({
            ...prev,
            isValid: true,
            flowData: parseIncrementalContent(content)
          }));
        }
      }
    } catch (error) {
      console.error('Error handling flow change:', error);
      if (setMetadata) {
        setMetadata(prev => ({
          ...prev,
          isValid: false,
          flowData: null
        }));
      }
    }

    // Reset flag after short delay
    setTimeout(() => {
      flowChangesRef.current = false;
    }, 100);
  }, [onSaveContent, setMetadata, isStreaming]);

  // Handle node position changes
  const handleNodeChanges = useCallback((changes: NodeChange[]) => {
    if (isStreaming) return;

    const positionChanges = changes.filter(
      (change): change is NodeChange & { position: { x: number; y: number } } => 
        change.type === 'position' && 
        !change.dragging && 
        change.position !== undefined
    );

    if (positionChanges.length > 0) {
      const updatedNodes = nodes.map(node => {
        const positionChange = positionChanges.find(change => change.id === node.id);
        if (positionChange?.position) {
          return {
            ...node,
            position: positionChange.position
          };
        }
        return node;
      });
      handleFlowChange(updatedNodes, edges);
    }
  }, [nodes, edges, handleFlowChange, isStreaming]);

  // Handle edge changes
  const handleEdgeChanges = useCallback((changes: EdgeChange[]) => {
    if (isStreaming) return;

    const hasEdgeChanges = changes.some(change => 
      change.type === 'remove' || change.type === 'add'
    );

    if (hasEdgeChanges) {
      const updatedEdges = edges.filter(edge => 
        !changes.some(change => 
          change.type === 'remove' && change.id === edge.id
        )
      );
      handleFlowChange(nodes, updatedEdges);
    }
  }, [nodes, edges, handleFlowChange, isStreaming]);

  return {
    handleNodeChanges,
    handleEdgeChanges,
    isFlowChange: () => flowChangesRef.current
  };
}

// Convert flow state to ACT content
function getActContentFromFlow(nodes: Node[], edges: Edge[]): string {
  let content = '[workflow]\nstart_node=""\n\n';
  
  // Add nodes section
  nodes.forEach(node => {
    content += `[node:${node.id}]\n`;
    content += `label="${node.data.label || node.id}"\n`;
    content += `node_type="${node.data.nodeType || 'default'}"\n`;
    content += `position_x=${Math.round(node.position.x)}\n`;
    content += `position_y=${Math.round(node.position.y)}\n`;
    
    // Add optional node properties
    if (node.data.operation) {
      content += `operation="${node.data.operation}"\n`;
    }
    if (node.data.operation_name) {
      content += `operation_name="${node.data.operation_name}"\n`;
    }
    if (node.data.formData && Object.keys(node.data.formData).length > 0) {
      content += `form_data=${JSON.stringify(node.data.formData)}\n`;
    }
    content += '\n';
  });

  // Add edges section if there are any edges
  if (edges.length > 0) {
    content += '[edges]\n';
    edges.forEach(edge => {
      content += `${edge.source}="${edge.target}"\n`;
    });
  }

  return content;
}

export function parseIncrementalContent(content: string, previousNodes: Record<string, any> = {}) {
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
        if (value.startsWith('{')) {
          parsedValue = JSON.parse(value);
        } else if (value.startsWith('"')) {
          parsedValue = value.slice(1, -1);
        } else if (value === 'true') {
          parsedValue = true;
        } else if (value === 'false') {
          parsedValue = false;
        } else if (!isNaN(Number(value))) {
          parsedValue = Number(value);
        }
      } catch (e) {
        console.warn('Error parsing value:', e);
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
        sections.workflow[key] = parsedValue;
      }
    }
  }

  return sections;
}