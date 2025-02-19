// File: lib/services/docker.ts

import { toast } from 'sonner';

export interface ContainerInfo {
  status: 'stopped' | 'running' | 'error';
  containerId: string | null;
  lastError?: string;
  startTime?: Date;
}

class DockerService {
  private static instance: DockerService;
  private containerStatus: Map<string, ContainerInfo>;
  private baseUrl: string;

  private constructor() {
    this.containerStatus = new Map();
    this.baseUrl = 'http://localhost:5001';
  }

  public static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  // Start a container for specific artifact
  public async startContainer(artifactId: string): Promise<boolean> {
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }

      // Check if service is healthy first
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        throw new Error('Docker service is not available');
      }

      // For this implementation, we're using a single service rather than 
      // individual containers. We'll generate a container ID and
      // track it in memory.
      const containerId = `sim-${artifactId.substring(0, 8)}-${Date.now()}`;
      
      this.containerStatus.set(artifactId, {
        status: 'running',
        containerId: containerId,
        startTime: new Date()
      });
      
      console.log(`Started simulated container for artifact: ${artifactId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error starting container: ${errorMessage}`);
      
      this.containerStatus.set(artifactId, {
        status: 'error',
        containerId: null,
        lastError: errorMessage
      });
      
      throw error;
    }
  }

  // Stop a specific artifact's container
  public async stopContainer(artifactId: string): Promise<boolean> {
    try {
      if (!artifactId) {
        throw new Error('Missing artifact ID');
      }

      const containerInfo = this.containerStatus.get(artifactId);
      if (!containerInfo?.containerId) {
        console.warn(`No container found for artifact: ${artifactId}`);
        return true; // Already stopped, so technically successful
      }

      // Since we're not actually creating containers per workflow,
      // we just update the status in our tracking
      this.containerStatus.set(artifactId, {
        status: 'stopped',
        containerId: null
      });
      
      console.log(`Stopped simulated container for artifact: ${artifactId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error stopping container: ${errorMessage}`);
      
      if (artifactId) {
        this.containerStatus.set(artifactId, {
          status: 'error',
          containerId: null,
          lastError: errorMessage
        });
      }
      
      throw error;
    }
  }

  // Execute workflow in specific container
  public async executeWorkflow(artifactId: string, content: string) {
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

      console.log(`Executing workflow for artifact: ${artifactId}`);

      // Execute workflow using the Python Flask service
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId, // We're sending this even though the current service doesn't use it
          content
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Execution failed: ${errorMsg}`);
      toast.error(`Execution failed: ${errorMsg}`);
      throw error;
    }
  }

  // Get container status for an artifact
  public getContainerStatus(artifactId: string): ContainerInfo {
    if (!artifactId) {
      console.warn('getContainerStatus called with missing artifactId');
      return {
        status: 'stopped',
        containerId: null,
        lastError: 'Missing artifact ID'
      };
    }
    
    return this.containerStatus.get(artifactId) || {
      status: 'stopped',
      containerId: null
    };
  }

  // Check health of a specific container
  public async checkContainerHealth(artifactId: string) {
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

      // For our implementation, we just check if the Python service is healthy
      const isHealthy = await this.checkHealth();
      
      if (!isHealthy) {
        this.containerStatus.set(artifactId, {
          ...containerInfo,
          status: 'error',
          lastError: 'Docker service is not available'
        });
        return { status: 'error', error: 'Docker service is not available' };
      }

      return {
        status: containerInfo.status,
        startTime: containerInfo.startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error checking container health: ${errorMessage}`);
      
      return {
        status: 'error',
        error: errorMessage
      };
    }
  }

  // Overall service health check
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
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
}

// Export singleton instance
export const dockerService = DockerService.getInstance();