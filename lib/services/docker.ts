// lib/services/docker.ts

import { toast } from 'sonner';

export interface ContainerInfo {
  status: 'stopped' | 'running' | 'error' | 'pending';
  containerId: string | null;
  port: number | null;
  lastError?: string;
  startTime?: Date;
  executionId?: string;
}

export interface ExecutionStatus {
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  status: 'success' | 'failed';
  operation?: string;
  result?: any;
  error?: string;
  executionId?: string;
  duration?: number;
}

class DockerService {
  private static instance: DockerService;
  private containerStatus: Map<string, ContainerInfo>;
  private statusPollingIntervals: Map<string, NodeJS.Timeout>;
  private executionStatusChecks: Map<string, NodeJS.Timeout>;
  private _baseUrl: string;

  private constructor() {
    this.containerStatus = new Map();
    this.statusPollingIntervals = new Map();
    this.executionStatusChecks = new Map();
    this._baseUrl = 'http://localhost:5001';
    console.log('Docker service initialized');
  }

  public static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  public get baseUrl(): string {
    return this._baseUrl;
  }

  private startStatusPolling(artifactId: string) {
    console.log('Starting status polling for artifact:', artifactId);
    if (this.statusPollingIntervals.has(artifactId)) {
      clearInterval(this.statusPollingIntervals.get(artifactId));
    }

    const interval = setInterval(async () => {
      await this.checkContainerHealth(artifactId);
    }, 10000);

    this.statusPollingIntervals.set(artifactId, interval);
  }

  private stopStatusPolling(artifactId: string) {
    console.log('Stopping status polling for artifact:', artifactId);
    const interval = this.statusPollingIntervals.get(artifactId);
    if (interval) {
      clearInterval(interval);
      this.statusPollingIntervals.delete(artifactId);
    }
  }

  public async startContainer(artifactId: string): Promise<boolean> {
    console.log('Starting container with artifact ID:', artifactId);
    try {
      if (!artifactId || artifactId.trim() === '') {
        throw new Error('Invalid or missing artifact ID');
      }

      // Check for existing running container
      const existingContainer = this.containerStatus.get(artifactId);
      if (existingContainer?.status === 'running' && existingContainer?.containerId) {
        const healthCheck = await this.checkContainerHealth(artifactId);
        if (healthCheck.status === 'running') {
          console.log('Container already running:', artifactId);
          return true;
        }
      }

      // Start new container
      const response = await fetch(`${this._baseUrl}/container/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          artifactId,
          volumes: {
            '/tmp': { bind: '/app/tmp', mode: 'rw' }
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.containerStatus.set(artifactId, {
          status: 'running',
          containerId: data.containerId,
          port: data.port,
          startTime: new Date()
        });

        this.startStatusPolling(artifactId);
        console.log(`Started container for artifact: ${artifactId} on port ${data.port}`);
        return true;
      } else {
        throw new Error(data.error || 'Failed to start container');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error starting container: ${errorMessage}`);
      
      this.containerStatus.set(artifactId, {
        status: 'error',
        containerId: null,
        port: null,
        lastError: errorMessage
      });
      
      throw error;
    }
  }

  public async stopContainer(artifactId: string): Promise<boolean> {
    console.log('Stopping container for artifact:', artifactId);
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId) {
        console.warn(`No container found for artifact: ${artifactId}`);
        return true;
      }

      this.stopStatusPolling(artifactId);

      const response = await fetch(`${this._baseUrl}/container/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.containerStatus.set(artifactId, {
          status: 'stopped',
          containerId: null,
          port: null
        });
        
        console.log(`Stopped container for artifact: ${artifactId}`);
        return true;
      } else {
        throw new Error(data.error || 'Failed to stop container');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error stopping container: ${errorMessage}`);
      
      if (artifactId) {
        const currentInfo = this.containerStatus.get(artifactId);
        this.containerStatus.set(artifactId, {
          status: 'error',
          containerId: currentInfo?.containerId || null,
          port: currentInfo?.port || null,
          lastError: errorMessage
        });
      }
      
      throw error;
    }
  }

  // Execute whole workflow
  public async executeWorkflow(artifactId: string, content: string) {
    console.log('Executing workflow for artifact:', artifactId);
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }
      
      if (!content) {
        throw new Error('Missing workflow content');
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId || containerInfo.status !== 'running') {
        throw new Error('Container is not running');
      }

      const response = await fetch(
        `http://localhost:${containerInfo.port}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (result.status === 'accepted') {
        const executionId = result.execution_id;
        this.containerStatus.set(artifactId, {
          ...containerInfo,
          executionId
        });

        const interval = setInterval(() => {
          this.checkExecutionStatus(artifactId, executionId);
        }, 1000);
        this.executionStatusChecks.set(executionId, interval);

        return {
          status: 'queued',
          executionId
        };
      } else {
        throw new Error(result.error || 'Failed to execute workflow');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Execution failed: ${errorMessage}`);
      throw error;
    }
  }

  // Simple method to execute a single node by using the full workflow execution
  public async executeSingleNode(
    artifactId: string, 
    nodeId: string, 
    workflowContent: string
  ): Promise<NodeExecutionResult> {
    console.log(`Executing single node ${nodeId} for artifact ${artifactId}`);
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }
      
      if (!nodeId) {
        throw new Error('Missing node ID');
      }
      
      if (!workflowContent) {
        throw new Error('Missing workflow content');
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId || containerInfo.status !== 'running') {
        throw new Error('Container is not running');
      }

      // Extract node section and create single-node workflow
      const singleNodeWorkflow = this.extractNodeWorkflow(workflowContent, nodeId);
      if (!singleNodeWorkflow) {
        throw new Error(`Node ${nodeId} not found in workflow content`);
      }

      // Execute the single node as a full workflow
      console.log(`Executing node ${nodeId} as a standalone workflow`);
      
      // Execute the workflow
      const response = await fetch(
        `http://localhost:${containerInfo.port}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: singleNodeWorkflow }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.status !== 'accepted' || !result.execution_id) {
        throw new Error('Failed to start node execution');
      }
      
      // Poll for execution status
      console.log(`Waiting for node execution to complete (ID: ${result.execution_id})`);
      const nodeResult = await this.waitForNodeExecution(containerInfo.port, result.execution_id, nodeId);
      
      console.log(`Node execution result:`, nodeResult);
      
      // Create a result compatible with what the AI expects
      const nodeOperation = this.extractNodeOperation(workflowContent, nodeId);
      
      return {
        nodeId,
        status: nodeResult.status === 'completed' ? 'success' : 'failed',
        operation: nodeOperation || nodeId,
        result: nodeResult.results?.[nodeId]?.result || nodeResult.result || null,
        error: nodeResult.error || nodeResult.results?.[nodeId]?.error || null,
        executionId: result.execution_id,
        duration: nodeResult.results?.[nodeId]?.duration || 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Node execution failed: ${errorMessage}`);
      
      return {
        nodeId,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  // Helper method to extract operation type from node
  private extractNodeOperation(workflowContent: string, nodeId: string): string {
    try {
      const nodeRegex = new RegExp(`\\[node:${nodeId}\\]([\\s\\S]*?)(?=\\[node:|\\[edges|$)`);
      const nodeMatch = workflowContent.match(nodeRegex);
      
      if (!nodeMatch) {
        return nodeId;
      }
      
      const nodeContent = nodeMatch[0];
      const operationMatch = nodeContent.match(/operation\s*=\s*([^\n]+)/);
      
      if (operationMatch) {
        return operationMatch[1].trim();
      }
      
      return nodeId;
    } catch (error) {
      console.error(`Error extracting node operation for ${nodeId}:`, error);
      return nodeId;
    }
  }

  // Helper method to wait for a node execution to complete
  private async waitForNodeExecution(port: number, executionId: string, nodeId: string, timeout = 25000): Promise<any> {
    const startTime = Date.now();
    let lastError = null;
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(
          `http://localhost:${port}/status/${executionId}`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (!response.ok) {
          console.log(`Status check failed with HTTP ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        const data = await response.json();
        
        if (data.status === 'completed' || data.status === 'failed') {
          console.log(`Node execution ${data.status}`);
          
          // For debugging purposes
          console.log(`Raw execution result:`, JSON.stringify(data, null, 2));
          
          return data;
        }
        
        console.log(`Node execution in progress: ${data.status}`);
      } catch (error) {
        console.error('Error checking node execution status:', error);
        lastError = error;
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Node execution timed out after ${timeout}ms` + (lastError ? `: ${lastError.message}` : ''));
  }

  // Helper method to extract a single node workflow
  private extractNodeWorkflow(workflowContent: string, nodeId: string): string {
    try {
      // Extract parameters section
      const parametersMatch = workflowContent.match(/\[parameters\]([\s\S]*?)(?=\[|$)/);
      const parameters = parametersMatch ? parametersMatch[0] : '[parameters]\n';
      
      // Extract workflow section
      const workflowMatch = workflowContent.match(/\[workflow\]([\s\S]*?)(?=\[|$)/);
      const workflow = workflowMatch 
        ? workflowMatch[0].replace(/start_node\s*=\s*[^\n]+/, `start_node = ${nodeId}`) 
        : `[workflow]\nname = Single Node Execution\nstart_node = ${nodeId}\n`;
      
      // Extract settings section
      const settingsMatch = workflowContent.match(/\[settings\]([\s\S]*?)(?=\[|$)/);
      const settings = settingsMatch ? settingsMatch[0] : '[settings]\ndebug = true\n';
      
      // Extract env section
      const envMatch = workflowContent.match(/\[env\]([\s\S]*?)(?=\[|$)/);
      const env = envMatch ? envMatch[0] : '[env]\n';
      
      // Extract the target node
      const nodeRegex = new RegExp(`\\[node:${nodeId}\\]([\\s\\S]*?)(?=\\[node:|\\[edges|$)`);
      const nodeMatch = workflowContent.match(nodeRegex);
      
      if (!nodeMatch) {
        console.error(`Node ${nodeId} not found in workflow content`);
        return null;
      }
      
      const nodeSection = nodeMatch[0];
      
      // Compose the single-node workflow
      return `${parameters}\n${workflow}\n${nodeSection}\n[edges]\n\n${settings}\n${env}`;
    } catch (error) {
      console.error('Error extracting node workflow:', error);
      return null;
    }
  }

  private async checkExecutionStatus(artifactId: string, executionId: string) {
    try {
      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.port) return;

      const response = await fetch(
        `http://localhost:${containerInfo.port}/status/${executionId}`
      );

      if (!response.ok) return;

      const data = await response.json();
      if (data.status === 'completed' || data.status === 'failed') {
        const interval = this.executionStatusChecks.get(executionId);
        if (interval) {
          clearInterval(interval);
          this.executionStatusChecks.delete(executionId);
        }

        this.containerStatus.set(artifactId, {
          ...containerInfo,
          executionId: undefined,
          lastError: data.status === 'failed' ? data.error : undefined
        });
      }
    } catch (error) {
      console.error(`Error checking execution status: ${error}`);
    }
  }

  public getContainerStatus(artifactId: string): ContainerInfo {
    if (!artifactId) {
      console.warn('getContainerStatus called with missing artifactId');
      return {
        status: 'stopped',
        containerId: null,
        port: null,
        lastError: 'Missing artifact ID'
      };
    }
    
    return this.containerStatus.get(artifactId) || {
      status: 'stopped',
      containerId: null,
      port: null
    };
  }

  public async checkContainerHealth(artifactId: string) {
    console.log('Checking container health for artifact:', artifactId);
    try {
      if (!artifactId) {
        return { 
          status: 'error',
          error: 'Missing artifact ID'
        };
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId) {
        return { status: 'stopped' };
      }

      // Try direct health check first
      if (containerInfo.port) {
        try {
          console.log(`Trying direct health check on port ${containerInfo.port}`);
          const directResponse = await fetch(`http://localhost:${containerInfo.port}/health`, {
            signal: AbortSignal.timeout(2000)
          });
          
          if (directResponse.ok) {
            const healthData = await directResponse.json();
            this.containerStatus.set(artifactId, {
              ...containerInfo,
              status: 'running',
              lastError: undefined
            });
            
            return {
              status: 'running',
              containerId: containerInfo.containerId,
              port: containerInfo.port,
              ...healthData
            };
          }
        } catch (directError) {
          // Fall through to manager health check
        }
      }

      // Fallback to manager health check
      const response = await fetch(`${this._baseUrl}/container/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifactId }),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Manager health check failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      this.containerStatus.set(artifactId, {
        ...containerInfo,
        status: data.status,
        lastError: data.error
      });

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error checking container health: ${errorMessage}`);
      
      if (artifactId && this.containerStatus.has(artifactId)) {
        const containerInfo = this.containerStatus.get(artifactId);
        this.containerStatus.set(artifactId, {
          ...containerInfo!,
          status: 'error',
          lastError: errorMessage
        });
      }
      
      return {
        status: 'error',
        error: errorMessage
      };
    }
  }

  public async streamLogs(artifactId: string, onLogReceived: (log: string) => void): Promise<void> {
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId) {
        throw new Error(`No container found for artifact ID: ${artifactId}`);
      }

      onLogReceived(`Container ID: ${containerInfo.containerId}`);
      onLogReceived(`Port: ${containerInfo.port || 'unknown'}`);
      onLogReceived(`Status: ${containerInfo.status}`);
      onLogReceived('---');

      const response = await fetch(`${this._baseUrl}/container/logs/${artifactId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to get logs: HTTP ${response.status}`);
      }

      const logText = await response.text();
      
      if (logText && logText.length > 0) {
        const lines = logText.split('\n');
        for (const line of lines) {
          if (line) {
            onLogReceived(line);
          }
        }
      } else {
        onLogReceived('No logs available for this container.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onLogReceived(`Error getting logs: ${errorMessage}`);
      console.error('Log streaming error:', error);
      throw error;
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this._baseUrl}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) {
        console.error(`Health check failed with status: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('Docker health check failed:', error);
      return false;
    }
  }

  public cleanup() {
    for (const interval of this.statusPollingIntervals.values()) {
      clearInterval(interval);
    }
    this.statusPollingIntervals.clear();

    for (const interval of this.executionStatusChecks.values()) {
      clearInterval(interval);
    }
    this.executionStatusChecks.clear();

    this.containerStatus.clear();
  }
}

// Export singleton instance
export const dockerService = DockerService.getInstance();