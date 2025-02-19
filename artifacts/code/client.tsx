'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import React, { memo, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Network, Layout, PlayCircle, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PlayIcon, CopyIcon, UndoIcon, RedoIcon, LogsIcon, MessageIcon } from '@/components/icons';
import { Console, ConsoleOutput, ConsoleOutputContent } from '@/components/console';
import { generateUUID } from '@/lib/utils';
import { dockerService } from '@/lib/services/docker';

// Basic Alert Component
const Alert = ({
  children,
  variant = 'default',
  className = ''
}: {
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
}) => (
  <div className={`p-4 rounded-lg ${variant === 'destructive' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
    }`}>
    {children}
  </div>
);

const AlertTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="font-semibold mb-1">{children}</div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-gray-600">{children}</div>
);

// Progress Component
const Progress = ({ value }: { value: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
      style={{ width: `${value}%` }}
    />
  </div>
);

// Parse ACT content
function parseActContent(content: string) {
  try {
    let currentSection = '';
    const sections: Record<string, any> = {
      workflow: {},
      nodes: {},
      edges: [],
      env: {}
    };

    const lines = content.split('\n').map(line => line.trim());
    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue;

      if (line.startsWith('[') && line.endsWith(']')) {
        currentSection = line.slice(1, -1);
        if (currentSection.startsWith('node:')) {
          const nodeId = currentSection.split(':')[1];
          sections.nodes[nodeId] = {
            id: nodeId,
            node_type: 'app name'
          };
        }
        continue;
      }

      if (line.includes('=')) {
        const [key, value] = line.split('=').map(part => part.trim());
        try {
          const parsedValue = value.startsWith('{') ?
            JSON.parse(value) :
            value.startsWith('"') ? value.slice(1, -1) : value;

          if (currentSection.startsWith('node:')) {
            const nodeId = currentSection.split(':')[1];
            sections.nodes[nodeId][key] = parsedValue;
          } else if (currentSection === 'edges') {
            sections.edges.push({
              source: key,
              target: parsedValue.replace(/['"]/g, '')
            });
          } else if (currentSection === 'workflow') {
            sections.workflow[key] = parsedValue;
          } else if (currentSection === 'env') {
            sections.env[key] = parsedValue;
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
      workflow: {},
      nodes: {},
      edges: [],
      env: {}
    };
  }
}

// Convert to ReactFlow elements
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
      background: '#fff',
      border: '1px solid #ddd',
      padding: 10,
      borderRadius: 5
    }
  }));

  let edgesArray: Array<{ source: string, target: string }> = [];

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
    style: { stroke: '#666' }
  }));

  return { nodes, edges };
}

// Code editor component
const CodeEditor = memo(({ content, onSaveContent }: {
  content: string;
  onSaveContent: (content: string, debounce: boolean) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const customTheme = EditorView.theme({
        "&": { color: "var(--foreground)" },
        ".cm-content": { color: "var(--foreground)" },
        ".cm-gutters": { backgroundColor: "var(--background)" },
      });

      const startState = EditorState.create({
        doc: content,
        extensions: [basicSetup, oneDark, customTheme],
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
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const customTheme = EditorView.theme({
        "&": { color: "var(--foreground)" },
        ".cm-content": { color: "var(--foreground)" },
        ".cm-gutters": { backgroundColor: "var(--background)" },
      });

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [basicSetup, oneDark, updateListener, customTheme],
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();
      if (currentContent !== content) {
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
  }, [content]);

  return <div ref={containerRef} className="w-full h-full" />;
});

CodeEditor.displayName = 'CodeEditor';

// Docker Status Component
const DockerStatus = ({ 
  status,
  containerId
}: { 
  status: 'ready' | 'unavailable' | 'running' | 'stopped' | 'error',
  containerId?: string | null 
}) => {
  const statusIndicators = {
    'ready': { color: 'bg-green-50 text-green-700', dot: 'bg-green-500', text: 'Docker Ready' },
    'unavailable': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Docker Unavailable' },
    'running': { color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500', text: 'Container Running' },
    'stopped': { color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-500', text: 'Container Stopped' },
    'error': { color: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'Container Error' }
  };

  const indicator = statusIndicators[status];

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${indicator.color}`}>
      <div className={`w-2 h-2 rounded-full ${indicator.dot}`} />
      <span className="text-sm">{indicator.text}</span>
      {containerId && status === 'running' && (
        <span className="text-xs opacity-75 ml-1">ID: {containerId.substring(0, 8)}</span>
      )}
    </div>
  );
};

// Main artifact export
export const codeArtifact = {
  kind: 'code' as const,
  description: 'ACT Workflow Configuration',
  initialize: async ({ setMetadata }) => {
    try {
      const isDockerHealthy = await dockerService.checkHealth();
      const newArtifactId = generateUUID();
      
      console.log(`Initializing new artifact with ID: ${newArtifactId}`);
      
      setMetadata({
        isValid: true,
        flowData: null,
        viewMode: 'code',
        artifactId: newArtifactId, // Ensure we have a valid artifact ID from the start
        containerId: null,
        containerStatus: 'stopped',
        executionId: null,
        executionStatus: null,
        executionResult: null,
        outputs: [],
        dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
        lastError: null
      });
    } catch (error) {
      console.error('Failed to initialize artifact:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      
      // Still create an artifactId even if docker is unavailable
      const newArtifactId = generateUUID();
      
      setMetadata({
        isValid: true,
        flowData: null,
        viewMode: 'code',
        artifactId: newArtifactId,
        containerId: null,
        containerStatus: 'stopped',
        executionId: null,
        executionStatus: null,
        executionResult: null,
        outputs: [],
        dockerStatus: 'unavailable',
        lastError: errorMessage
      });
    }
  },
  content: ({ content, onSaveContent, metadata, setMetadata, document }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [viewMode, setViewMode] = useState('code');

    // Ensure artifactId exists
    useEffect(() => {
      if (!metadata?.artifactId) {
        const newArtifactId = generateUUID();
        console.log(`Creating missing artifactId: ${newArtifactId}`);
        setMetadata(prev => ({
          ...prev,
          artifactId: newArtifactId
        }));
      }
    }, [metadata, setMetadata]);

    // Check Docker container health periodically
    useEffect(() => {
      if (!metadata?.artifactId) {
        console.warn('No artifactId available for health check');
        return;
      }

      const checkContainerHealth = async () => {
        if (metadata.containerStatus === 'running' && metadata.containerId) {
          try {
            const healthResult = await dockerService.checkContainerHealth(metadata.artifactId);
            if (healthResult.status !== metadata.containerStatus) {
              setMetadata({
                ...metadata,
                containerStatus: healthResult.status,
                lastError: healthResult.error
              });
            }
          } catch (error) {
            console.error('Failed to check container health:', error);
          }
        }
      };

      const intervalId = setInterval(checkContainerHealth, 10000); // Check every 10 seconds
      return () => clearInterval(intervalId);
    }, [metadata, setMetadata]);

    useEffect(() => {
      if (content) {
        try {
          const parsedContent = parseActContent(content);
          const { nodes: flowNodes, edges: flowEdges } = convertToReactFlowElements(parsedContent);
          setNodes(flowNodes);
          setEdges(flowEdges);
          console.log("Parsed content successfully, setting isValid=true");
          setMetadata({
            ...metadata,
            isValid: true,
            flowData: parsedContent
          });
        } catch (error) {
          console.error('Failed to parse ACT file:', error);
          console.log("Parse error, but keeping isValid=true to allow execution");
          setMetadata({
            ...metadata,
            flowData: null,
            isValid: true
          });
        }
      }
    }, [content, setMetadata, setNodes, setEdges, metadata]);

    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <DockerStatus 
            status={
              metadata?.dockerStatus === 'unavailable' 
                ? 'unavailable' 
                : metadata?.containerStatus || 'stopped'
            } 
            containerId={metadata?.containerId}
          />
        </div>

        {viewMode === 'code' ? (
          <div className="w-full h-[calc(100vh-200px)]">
            <CodeEditor content={content} onSaveContent={onSaveContent} />
            {metadata?.isValid === false && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Invalid ACT Configuration</AlertTitle>
                <AlertDescription>
                  Please check your workflow configuration for errors.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div style={{ width: '100%', height: 'calc(100vh-200px)' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: metadata?.executionStatus === 'running'
              }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        )}

        {metadata?.outputs && (
          <Console
            consoleOutputs={metadata.outputs}
            setConsoleOutputs={() => {
              setMetadata({
                ...metadata,
                outputs: [],
              });
            }}
          />
        )}
      </div>
    );
  },
  actions: [
    {
      icon: <PlayCircle size={18} />,
      label: 'Start Container',
      description: 'Start a Docker container for this workflow',
      onClick: async ({ setMetadata, metadata }) => {
        try {
          // Ensure we have an artifactId
          if (!metadata?.artifactId) {
            const newArtifactId = generateUUID();
            console.log(`Creating artifactId before starting container: ${newArtifactId}`);
            
            // Update metadata with new artifactId
            setMetadata((prevMetadata: any) => ({
              ...prevMetadata,
              artifactId: newArtifactId,
              containerStatus: 'pending'
            }));
            
            // Use the new artifactId
            var artifactId = newArtifactId;
          } else {
            var artifactId = metadata.artifactId;
          }

          // First check Docker health
          const isHealthy = await dockerService.checkHealth();
          if (!isHealthy) {
            toast.error('Docker service is not available');
            return;
          }

          // Check if container is already running
          if (metadata?.containerStatus === 'running' && metadata?.containerId) {
            toast.info('Container is already running');
            return;
          }

          console.log(`Starting container for artifact: ${artifactId}`);
          setMetadata((prevMetadata: any) => ({
            ...prevMetadata,
            containerStatus: 'pending'
          }));

          // Start a new container for this artifact
          const success = await dockerService.startContainer(artifactId);
          if (success) {
            // Get updated container info
            const containerInfo = dockerService.getContainerStatus(artifactId);
            
            setMetadata((prevMetadata: any) => ({
              ...prevMetadata,
              containerStatus: containerInfo.status,
              containerId: containerInfo.containerId,
              lastError: containerInfo.lastError,
              outputs: [
                ...(prevMetadata.outputs || []),
                {
                  id: generateUUID(),
                  contents: [{
                    type: 'text',
                    value: `> Container started successfully! ID: ${containerInfo.containerId}`
                  }],
                  status: 'completed',
                }
              ]
            }));
            
            toast.success('Container started successfully');
          } else {
            throw new Error('Failed to start container');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to start container';
          console.error(`Container start error: ${errorMessage}`);
          
          setMetadata((prevMetadata: any) => ({
            ...prevMetadata,
            containerStatus: 'error',
            lastError: errorMessage,
            outputs: [
              ...(prevMetadata.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Error starting container: ${errorMessage}`
                }],
                status: 'failed',
              }
            ]
          }));
          
          toast.error(errorMessage);
        }
      },
      isDisabled: ({ metadata }) => 
        metadata?.containerStatus === 'running' || 
        metadata?.dockerStatus === 'unavailable'
    },
    // ... other actions
  
    {
      icon: <PlayCircle size={18} />,
      label: 'Execute Workflow',
      description: 'Execute workflow in Docker container',
      onClick: async ({ setMetadata, content, metadata }) => {
        try {
          const artifactId = metadata?.artifactId;
          if (!artifactId) {
            throw new Error('Missing artifact ID');
          }

          // Check if container is running
          const containerInfo = dockerService.getContainerStatus(artifactId);
          if (containerInfo.status !== 'running' || !containerInfo.containerId) {
            toast.error('Container is not running. Please start the container first.');
            return;
          }

          const runId = generateUUID();
          const outputContent: Array<ConsoleOutputContent> = [];

          // Update metadata to show execution is starting
          setMetadata((prevMetadata: any) => ({
            ...prevMetadata,
            executionId: runId,
            executionStatus: 'running',
            outputs: [
              ...(prevMetadata.outputs || []),
              {
                id: runId,
                contents: [],
                status: 'in_progress',
              }
            ]
          }));

          // Execute workflow in the container
          const result = await dockerService.executeWorkflow(artifactId, content);

          if (result.status === 'success') {
            outputContent.push({
              type: 'text',
              value: '> Workflow execution completed successfully!'
            });

            if (result.result) {
              outputContent.push({
                type: 'text',
                value: `> Result: ${JSON.stringify(result.result, null, 2)}`
              });
            }

            setMetadata((prevMetadata: any) => ({
              ...prevMetadata,
              executionStatus: 'completed',
              executionResult: result,
              outputs: [
                ...(prevMetadata.outputs.filter((output: any) => output.id !== runId)),
                {
                  id: runId,
                  contents: [...outputContent],
                  status: 'completed',
                }
              ]
            }));

            toast.success('Workflow execution completed');
          } else {
            outputContent.push({
              type: 'text',
              value: `> Error: ${result.error || 'Unknown error'}`
            });

            setMetadata((prevMetadata: any) => ({
              ...prevMetadata,
              executionStatus: 'failed',
              executionResult: result,
              outputs: [
                ...(prevMetadata.outputs.filter((output: any) => output.id !== runId)),
                {
                  id: runId,
                  contents: [...outputContent],
                  status: 'failed',
                }
              ]
            }));

            toast.error(`Execution failed: ${result.error || 'Unknown error'}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to execute workflow';
          
          setMetadata((prevMetadata: any) => ({
            ...prevMetadata,
            executionStatus: 'failed',
            executionResult: { error: errorMessage },
            outputs: [
              ...(prevMetadata.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Error: ${errorMessage}`
                }],
                status: 'failed',
              }
            ]
          }));

          toast.error(errorMessage);
        }
      },
      isDisabled: ({ metadata }) => 
        metadata?.containerStatus !== 'running' || 
        metadata?.executionStatus === 'running'
    },
    {
      icon: <PlayCircle size={18} className="text-red-500" />,
      label: 'Stop Container',
      description: 'Stop the Docker container',
      onClick: async ({ setMetadata, metadata }) => {
        try {
          const artifactId = metadata?.artifactId;
          if (!artifactId) {
            throw new Error('Missing artifact ID');
          }

          // Check if container is running
          const containerInfo = dockerService.getContainerStatus(artifactId);
          if (containerInfo.status !== 'running' || !containerInfo.containerId) {
            toast.info('No running container to stop');
            return;
          }

          const success = await dockerService.stopContainer(artifactId);
          if (success) {
            setMetadata((prevMetadata: any) => ({
              ...prevMetadata,
              containerStatus: 'stopped',
              containerId: null,
              outputs: [
                ...(prevMetadata.outputs || []),
                {
                  id: generateUUID(),
                  contents: [{
                    type: 'text',
                    value: '> Container stopped successfully'
                  }],
                  status: 'completed',
                }
              ]
            }));
            
            toast.success('Container stopped successfully');
          } else {
            throw new Error('Failed to stop container');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to stop container';
          
          setMetadata((prevMetadata: any) => ({
            ...prevMetadata,
            lastError: errorMessage,
            outputs: [
              ...(prevMetadata.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Error stopping container: ${errorMessage}`
                }],
                status: 'failed',
              }
            ]
          }));
          
          toast.error(errorMessage);
        }
      },
      isDisabled: ({ metadata }) => metadata?.containerStatus !== 'running'
    },
    {
      icon: <RefreshCw size={18} />,
      label: 'Reset',
      description: 'Reset execution state and stop container',
      onClick: async ({ setMetadata, metadata }) => {
        try {
          // Try to stop container if it's running
          if (metadata?.containerStatus === 'running' && metadata?.artifactId) {
            try {
              await dockerService.stopContainer(metadata.artifactId);
            } catch (error) {
              console.warn('Failed to stop container during reset:', error);
            }
          }
          
          const isDockerHealthy = await dockerService.checkHealth();
          const artifactId = metadata?.artifactId || generateUUID();
          
          setMetadata({
            isValid: true,
            flowData: null,
            viewMode: 'code',
            artifactId: artifactId,
            containerId: null,
            containerStatus: 'stopped',
            executionId: null,
            executionStatus: null,
            executionResult: null,
            outputs: [],
            dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
            lastError: null
          });
          
          toast.success('Environment reset successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Reset failed';
          toast.error(errorMessage);
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy configuration to clipboard',
      onClick: ({ content }) => {
        if (!content) {
          toast.error('No content to copy');
          return;
        }
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    }
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: 'Add comments',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add comments to the ACT configuration for better understanding',
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: 'Add node documentation',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content: 'Add detailed documentation for each node in the workflow',
        });
      },
    },
  ],
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'code-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible:
          draftArtifact.status === 'streaming' &&
            draftArtifact.content.length > 300 &&
            draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },
};

// Add custom styles for ACT syntax highlighting and flow visualization
const styles = `
.cm-section-header {
  color: #569cd6;
  font-weight: bold;
}

.cm-key {
  color: #9cdcfe;
}

.cm-value {
  color: #ce9178;
}

.cm-node-type {
  color: #4ec9b0;
}

.cm-comment {
  color: #6a9955;
  font-style: italic;
}

.react-flow__node {
  padding: 10px;
  border-radius: 5px;
  font-size: 12px;
  color: #333;
  text-align: center;
  border-width: 2px;
  width: 150px;
}

.react-flow__node.running {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.react-flow__node.completed {
  border-color: #22c55e;
  background-color: #f0fdf4;
}

.react-flow__node.failed {
  border-color: #ef4444;
  background-color: #fef2f2;
}

.react-flow__edge-path {
  stroke-width: 2;
}

.react-flow__edge.animated path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

@keyframes dashdraw {
  from {
    stroke-dashoffset: 10;
  }
}
`;

// Inject custom styles for ACT syntax highlighting and flow visualization
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Export the complete artifact
export default codeArtifact;