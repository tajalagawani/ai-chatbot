// ConsoleHelpers.ts
import { ConsoleOutput, WorkflowStatus } from './ConsoleTypes';

// Helper function to safely format timestamps
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Check if timestamp is a valid date string or timestamp
    const date = new Date(timestamp);
    
    // Check if date is valid (Invalid Date objects return NaN for getTime())
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleTimeString();
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

// Format JSON for better display
export const formatJson = (jsonObj) => {
  try {
    return JSON.stringify(jsonObj, null, 2);
  } catch (error) {
    console.error('Error formatting JSON:', error);
    return JSON.stringify(jsonObj);
  }
};

// Try to detect if a string contains JSON and format it
export const formatPossibleJson = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Check if the string looks like JSON
  if ((text.trim().startsWith('{') && text.trim().endsWith('}')) || 
      (text.trim().startsWith('[') && text.trim().endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      return formatJson(parsed);
    } catch {
      // Not valid JSON, return as is
      return text;
    }
  }
  
  return text;
};

// Extract node status from console output content
export const extractWorkflowStatus = (consoleOutput: ConsoleOutput): WorkflowStatus | null => {
  try {
    // Find content with execution result
    const resultContent = consoleOutput.contents.find(content => 
      content.value.includes('Execution completed:') || 
      content.value.includes('Execution failed:')
    );
    
    if (!resultContent) return null;
    
    // Extract JSON from the content
    const jsonStart = resultContent.value.indexOf('{');
    if (jsonStart === -1) return null;
    
    const jsonString = resultContent.value.substring(jsonStart);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error extracting workflow status:', error);
    return null;
  }
};

// Get status colors without JSX
export const getStatusStyles = (status) => {
  switch(status) {
    case 'completed':
      return {
        bg: "rgba(6, 78, 59, 0.15)",
        border: "rgba(16, 185, 129, 0.3)",
        text: "#10b981",
        badgeBg: "rgba(16, 185, 129, 0.15)",
        iconType: "check"
      };
    case 'failed':
      return {
        bg: "rgba(127, 29, 29, 0.15)",
        border: "rgba(239, 68, 68, 0.3)",
        text: "#ef4444",
        badgeBg: "rgba(239, 68, 68, 0.15)",
        iconType: "alert"
      };
    case 'in_progress':
      return {
        bg: "rgba(120, 53, 15, 0.15)",
        border: "rgba(245, 158, 11, 0.3)",
        text: "#f59e0b",
        badgeBg: "rgba(245, 158, 11, 0.15)",
        iconType: "loader"
      };
    case 'pending':
    default:
      return {
        bg: "rgba(30, 58, 138, 0.15)",
        border: "rgba(59, 130, 246, 0.3)",
        text: "#3b82f6",
        badgeBg: "rgba(59, 130, 246, 0.15)",
        iconType: "clock"
      };
  }
};