import { useState, useCallback, useEffect } from 'react';
import { WorkflowExecutionResult } from '../types';

export function useWorkflowExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<WorkflowExecutionResult | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Poll for execution status
  useEffect(() => {
    if (!executionId) return;
    
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/workflow/status/${executionId}`);
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        setExecutionStatus(result);
        
        // If execution is complete or failed, stop polling
        if (result.status === 'completed' || result.status === 'failed') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        }
      } catch (error) {
        console.error('Failed to poll execution status:', error);
        // Stop polling on error
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    };
    
    // Start polling (every 2 seconds)
    const interval = setInterval(pollStatus, 2000);
    setPollingInterval(interval);
    
    // Initial poll
    pollStatus();
    
    return () => {
      clearInterval(interval);
    };
  }, [executionId]);

  const executeWorkflow = useCallback(async (documentId: string) => {
    setIsExecuting(true);
    setExecutionStatus(null);
    setExecutionId(null);
    
    try {
      const response = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      });

      const result = await response.json();
      
      if (result.success && result.executionId) {
        setExecutionId(result.executionId);
        return result;
      } else {
        setExecutionStatus(result);
        return result;
      }
    } catch (error) {
      setExecutionStatus({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      });
      throw error;
    } finally {
      if (!executionId) {
        setIsExecuting(false);
      }
    }
  }, []);

  const validateWorkflow = useCallback(async (documentId: string) => {
    try {
      const response = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }, []);

  return {
    executeWorkflow,
    validateWorkflow,
    isExecuting,
    executionStatus,
    executionId
  };
}