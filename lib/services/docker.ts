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

      // Check if service is healthy
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        throw new Error('Docker service is not available');
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
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
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
          console.warn(`Direct health check error: ${directError.message}`);
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