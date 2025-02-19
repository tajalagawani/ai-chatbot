import { useCallback, useEffect, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { ActParser } from './parser';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom language support for ACT files
const actLanguage = () => {
  // This is a basic implementation - can be enhanced for better syntax highlighting
  return EditorState.transactionFilter.of(tr => {
    // Add custom syntax highlighting and validation here
    return tr;
  });
};

export const actArtifact = {
  kind: 'act' as const,
  description: 'ACT Workflow Configuration',
  initialize: async ({ setMetadata }) => {
    setMetadata({
      isValid: true,
      flowData: null,
    });
  },
  content: ({ content, onSaveContent, metadata, setMetadata }) => {
    const [isFlowView, setIsFlowView] = useState(false);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const updateFlowData = useCallback((content: string) => {
      try {
        const parser = new ActParser(content);
        const workflow = parser.parse();
        
        // Convert workflow nodes to ReactFlow nodes
        const flowNodes = Object.entries(workflow.nodes).map(([id, node]) => ({
          id,
          type: 'default',
          position: { x: node.position_x || 0, y: node.position_y || 0 },
          data: { label: node.label || id }
        }));

        // Convert workflow edges to ReactFlow edges
        const flowEdges = workflow.edges.map((edge, index) => ({
          id: `edge-${index}`,
          source: edge.source,
          target: edge.target,
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
        setMetadata({ ...metadata, isValid: true, flowData: workflow });
      } catch (error) {
        console.error('Failed to parse ACT file:', error);
        setMetadata({ ...metadata, isValid: false, flowData: null });
      }
    }, [metadata, setMetadata, setNodes, setEdges]);

    useEffect(() => {
      updateFlowData(content);
    }, [content, updateFlowData]);

    if (isFlowView) {
      return (
        <div style={{ height: '80vh', width: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <CodeEditor
          content={content}
          onSaveContent={onSaveContent}
          language={actLanguage}
        />
        {!metadata.isValid && (
          <div className="absolute bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded">
            Invalid ACT file format
          </div>
        )}
      </div>
    );
  },
  actions: [
    {
      icon: '⚡',
      label: 'Toggle View',
      description: 'Switch between code and flow view',
      onClick: ({ setMetadata }) => {
        setMetadata((metadata: any) => ({
          ...metadata,
          isFlowView: !metadata.isFlowView,
        }));
      },
    },
    // Add more actions as needed
  ],
};