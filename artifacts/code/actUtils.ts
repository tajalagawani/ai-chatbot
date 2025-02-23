// utils/actUtils.ts

export function isActContent(content: string): boolean {
    if (!content) return false;
    return (
      content.includes('[workflow]') || 
      content.includes('[node:') ||
      (content.includes('start_node') && content.includes('operation'))
    );
  }
  
  export function validateActContent(content: string): boolean {
    try {
      // Basic structure validation
      const lines = content.split('\n');
      let hasWorkflow = false;
      let hasNode = false;
  
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('[workflow]')) {
          hasWorkflow = true;
        } else if (trimmedLine.startsWith('[node:')) {
          hasNode = true;
        }
      }
  
      return hasWorkflow && hasNode;
    } catch (error) {
      return false;
    }
  }