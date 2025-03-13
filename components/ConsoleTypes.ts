// ConsoleTypes.ts
import { Dispatch, SetStateAction } from 'react';

export type OutputContentType = 'text' | 'image' | 'error' | 'warning' | 'info' | 'success';

export interface ConsoleOutputContent {
  type: OutputContentType;
  value: string;
  timestamp?: string;
}

export interface ConsoleOutput {
  id: string;
  status: 'in_progress' | 'loading_packages' | 'completed' | 'failed';
  contents: Array<ConsoleOutputContent>;
  timestamp?: string;
  executionTime?: number; // in milliseconds
}

export interface ConsoleProps {
  consoleOutputs: Array<ConsoleOutput>;
  setConsoleOutputs: Dispatch<SetStateAction<Array<ConsoleOutput>>>;
  maxHeight?: number;
  minHeight?: number;
  initialHeight?: number;
}

export interface NodeStatus {
  message: string;
  status: 'completed' | 'failed' | 'pending' | 'in_progress';
  timestamp: string;
}

export interface WorkflowStatus {
  result?: {
    message: string;
    node_status: Record<string, NodeStatus>;
    results?: Record<string, any>;
  };
  status?: string;
  error?: string;
}

// Theme colors - Darker theme
export const THEME = {
  bg: {
    primary: '#000000',
    card: '#030303',
    header: '#050505',
    section: '#030303',
    border: '#1a1a1a'
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8',
    muted: '#4b5563'
  },
  status: {
    completed: {
      bg: 'rgba(6, 78, 59, 0.15)',
      border: 'rgba(16, 185, 129, 0.3)',
      text: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)'
    },
    failed: {
      bg: 'rgba(127, 29, 29, 0.15)',
      border: 'rgba(239, 68, 68, 0.3)',
      text: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)'
    },
    pending: {
      bg: 'rgba(30, 58, 138, 0.15)',
      border: 'rgba(59, 130, 246, 0.3)',
      text: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.15)'
    },
    in_progress: {
      bg: 'rgba(120, 53, 15, 0.15)',
      border: 'rgba(245, 158, 11, 0.3)',
      text: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.15)'
    }
  }
};