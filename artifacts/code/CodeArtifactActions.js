'use client';

import React from 'react';
import { Network, PlayCircle, AlertCircle, RefreshCw, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { CopyIcon, UndoIcon, RedoIcon } from '@/components/icons';
import { generateUUID } from '@/lib/utils';
import { dockerService } from '@/lib/services/docker';

export const actions = [
  {
    icon: <PlayCircle size={16} />,
    label: 'Start',
    description: 'Prepare workflow for execution',
    onClick: async ({ setMetadata, metadata }) => {
      try {
        if (!metadata?.artifactId) {
          throw new Error('No artifact ID found in metadata');
        }
    
        const isHealthy = await dockerService.checkHealth();
        if (!isHealthy) {
          throw new Error('Docker service is not available');
        }
    
        const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
        if (containerInfo.status === 'running' && containerInfo.containerId) {
          toast.info('Container is already running');
          return;
        }
    
        setMetadata(prev => ({
          ...prev,
          containerStatus: 'pending',
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: '> Starting Docker container...'
              }],
              status: 'in_progress'
            }
          ]
        }));
    
        const success = await dockerService.startContainer(metadata.artifactId);
        
        if (success) {
          const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
          
          setMetadata(prev => ({
            ...prev,
            containerStatus: containerInfo.status,
            containerId: containerInfo.containerId,
            port: containerInfo.port,
            lastError: containerInfo.lastError,
            outputs: [
              ...(prev.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Container started successfully
> ID: ${containerInfo.containerId?.substring(0, 12) || 'unknown'}
> Port: ${containerInfo.port || 'unknown'}
> Status: ${containerInfo.status}`
                }],
                status: 'completed',
              }
            ]
          }));
          
          toast.success('Container is ready for execution');
        } else {
          throw new Error('Container failed to start');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start container';
        console.error(`Container start error: ${errorMessage}`);
        
        setMetadata(prev => ({
          ...prev,
          containerStatus: 'error',
          lastError: errorMessage,
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: `> Error starting container: ${errorMessage}`
              }],
              status: 'failed'
            }
          ]
        }));
        
        toast.error(errorMessage);
      }
    },
    isDisabled: ({ metadata }) => metadata?.dockerStatus === 'unavailable'
  },
  {
    icon: <PlayCircle size={16} />,
    label: 'Run Agent',
    description: 'Run workflow in container',
    onClick: async ({ setMetadata, content, metadata }) => {
      try {
        if (!metadata?.artifactId) {
          throw new Error('Missing artifact ID');
        }
  
        const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
        if (containerInfo.status !== 'running' || !containerInfo.containerId) {
          throw new Error('Container is not running. Please start it first.');
        }
  
        setMetadata(prev => ({
          ...prev,
          executionStatus: 'running',
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: '> Starting workflow execution...'
              }],
              status: 'in_progress',
            }
          ]
        }));
  
        const response = await fetch(
          `http://localhost:${containerInfo.port}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
          }
        );
  
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
        }
  
        const result = await response.json();
  
        if (result.status === 'accepted') {
          setMetadata(prev => ({
            ...prev,
            executionId: result.execution_id,
            executionStatus: 'running',
            containerStatus: 'running',
            outputs: [
              ...(prev.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: `> Workflow queued for execution
> Execution ID: ${result.execution_id}`
                }],
                status: 'in_progress'
              }
            ]
          }));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to execute workflow';
        console.error('Execution error:', errorMessage);
        
        setMetadata(prev => ({
          ...prev,
          executionStatus: 'failed',
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: `> Error executing workflow: ${errorMessage}`
              }],
              status: 'failed'
            }
          ]
        }));
  
        toast.error(errorMessage);
      }
    },
    isDisabled: ({ metadata }) => 
      !metadata?.containerStatus || 
      metadata.containerStatus !== 'running' || 
      metadata.executionStatus === 'running'
  },
  {
    icon: <PlayCircle size={16} className="text-red-500" />,
    label: 'Stop',
    description: 'Stop the agent',
    onClick: async ({ setMetadata, metadata }) => {
      try {
        if (!metadata?.artifactId) {
          throw new Error('Missing artifact ID');
        }

        const containerInfo = dockerService.getContainerStatus(metadata.artifactId);
        if (containerInfo.status !== 'running' || !containerInfo.containerId) {
          toast.info('No running container to stop');
          return;
        }

        setMetadata(prev => ({
          ...prev,
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: '> Stopping container...'
              }],
              status: 'in_progress'
            }
          ]
        }));

        const success = await dockerService.stopContainer(metadata.artifactId);
        if (success) {
          setMetadata(prev => ({
            ...prev,
            containerStatus: 'stopped',
            containerId: null,
            port: null,
            outputs: [
              ...(prev.outputs || []),
              {
                id: generateUUID(),
                contents: [{
                  type: 'text',
                  value: '> Container stopped successfully'
                }],
                status: 'completed'
              }
            ]
          }));
          
          toast.success('Container stopped successfully');
        } else {
          throw new Error('Failed to stop container');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stop container';
        
        setMetadata(prev => ({
          ...prev,
          lastError: errorMessage,
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: `> Error stopping container: ${errorMessage}`
              }],
              status: 'failed'
            }
          ]
        }));
        
        toast.error(errorMessage);
      }
    },
    isDisabled: ({ metadata }) => metadata?.containerStatus !== 'running'
  },
  {
    icon: <Network size={16} />,
    // label: 'Toggle View', 
    description: 'Switch between Code and Flow views',
    onClick: ({ metadata, setMetadata }) => {
      const isFlowView = metadata?.viewMode === 'flow';
      const newViewMode = isFlowView ? 'code' : 'flow';
      
      setMetadata(prev => ({
        ...prev,
        viewMode: newViewMode
      }));
    },
    isDisabled: ({ metadata }) => !metadata?.isValid || !metadata?.showFlowOption
  },
  {
    icon: <Maximize2 size={16} />,
    // label: 'Fullscreen',
    description: 'Enter fullscreen mode for Flow view',
    onClick: ({ metadata, setMetadata }) => {
      setMetadata(prev => ({
        ...prev,
        isFlowFullscreen: !prev.isFlowFullscreen
      }));
    },
    isDisabled: ({ metadata }) => metadata?.viewMode !== 'flow' || !metadata?.showFlowOption
  },
  {
    icon: <RefreshCw size={16} />,
    // label: 'Reset',
    description: 'Reset execution state and stop container',
    onClick: async ({ setMetadata, metadata }) => {
      try {
        setMetadata(prev => ({
          ...prev,
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: '> Resetting environment...'
              }],
              status: 'in_progress'
            }
          ]
        }));

        if (metadata?.containerStatus === 'running' && metadata?.artifactId) {
          try {
            await dockerService.stopContainer(metadata.artifactId);
            
            setMetadata(prev => ({
              ...prev,
              outputs: [
                ...(prev.outputs || []),
                {
                  id: generateUUID(),
                  contents: [{
                    type: 'text',
                    value: '> Successfully stopped container'
                  }],
                  status: 'completed'
                }
              ]
            }));
          } catch (error) {
            console.warn('Failed to stop container during reset:', error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            
            setMetadata(prev => ({
              ...prev,
              outputs: [
                ...(prev.outputs || []),
                {
                  id: generateUUID(),
                  contents: [{
                    type: 'text',
                    value: `> Warning: Failed to stop container: ${errorMsg}`
                  }],
                  status: 'failed'
                }
              ]
            }));
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
          port: null,
          containerStatus: 'stopped',
          executionId: null,
          executionStatus: null,
          executionResult: null,
          outputs: [{
            id: generateUUID(),
            contents: [{
              type: 'text',
              value: `> Environment reset complete
> Docker status: ${isDockerHealthy ? 'ready' : 'unavailable'}`
            }],
            status: 'completed'
          }],
          dockerStatus: isDockerHealthy ? 'ready' : 'unavailable',
          lastError: null
        });
        
        toast.success('Environment reset successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Reset failed';
        
        setMetadata(prev => ({
          ...prev,
          outputs: [
            ...(prev.outputs || []),
            {
              id: generateUUID(),
              contents: [{
                type: 'text',
                value: `> Reset failed: ${errorMessage}`
              }],
              status: 'failed'
            }
          ],
          lastError: errorMessage
        }));
        
        toast.error(errorMessage);
      }
    },
    isDisabled: ({ metadata }) => metadata?.executionStatus === 'running'
  },
  {
    icon: <UndoIcon size={16} />,
    // label: 'Previous Version',
    description: 'View Previous version',
    onClick: ({ handleVersionChange }) => {
      handleVersionChange('prev');
    },
    isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0
  },
  {
    icon: <RedoIcon size={16} />,
    // label: 'Next Version',
    description: 'View Next version',
    onClick: ({ handleVersionChange }) => {
      handleVersionChange('next');
    },
    isDisabled: ({ isCurrentVersion }) => isCurrentVersion
  },
  {
    icon: <CopyIcon size={16} />,
    label: 'Copy',
    description: 'Copy configuration to clipboard',
    onClick: ({ content }) => {
      if (!content) {
        toast.error('No content to copy');
        return;
      }
      navigator.clipboard.writeText(content);
      toast.success('Copied to clipboard!');
    }
  }
];

export default actions;