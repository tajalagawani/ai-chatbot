import { useState, useEffect } from 'react';
import { WorkflowStatus } from '@/lib/act/types';

export function useWorkflowStatus(executionId: string | null) {
  const [status, setStatus] = useState<WorkflowStatus>('pending');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!executionId) return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/workflow/status?executionId=${executionId}`);
        const data = await response.json();

        if (data.success) {
          setStatus(data.status);
          setProgress(data.progress);

          if (data.status !== 'completed' && data.status !== 'failed') {
            // Continue polling if workflow is still running
            setTimeout(checkStatus, 1000);
          }
        }
      } catch (error) {
        console.error('Failed to fetch workflow status:', error);
        setStatus('failed');
      }
    };

    checkStatus();

    return () => {
      setStatus('pending');
      setProgress(0);
    };
  }, [executionId]);

  return { status, progress };
}