// lib/voice/client-api.ts
import { v4 as uuidv4 } from 'uuid';

// Client-safe API for workflow operations
export async function executeClientWorkflow(userRequest: string) {
  try {
    const response = await fetch('/api/workflow/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        userRequest,
        requestId: uuidv4()
      }),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing workflow:', error);
    throw error;
  }
}

// Client-safe API to get documents
export async function getRecentWorkflows() {
  try {
    const response = await fetch('/api/document/recent?kind=code&limit=1');
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent workflows:', error);
    return [];
  }
}