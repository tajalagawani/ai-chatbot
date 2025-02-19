// ======================================================
// File: /artifacts/act/types.ts
// ======================================================
export interface ActNode {
    id: string;
    label: string;
    position_x: number;
    position_y: number;
    operation: string;
    node_type: 'app name';
    operation_name: string;
    params: Record<string, any>;
    mode: string;
    api_key?: string;
    slack_token?: string;
    method?: string;
    formData?: Record<string, any>;
  }
  
  export interface ActWorkflow {
    workflow_id?: string;
    name: string;
    description: string;
    start_node: string;
    nodes: Record<string, ActNode>;
    edges: Array<{
      source: string;
      target: string;
    }>;
    env: Record<string, string>;
  }
  
  // ======================================================
  // File: /artifacts/act/parser.ts
  // ======================================================
  import { ActWorkflow, ActNode } from './types';
  
  export class ActParser {
    private lines: string[];
    private currentSection: string = '';
    private workflow: Partial<ActWorkflow> = {};
    private currentNode: Partial<ActNode> = {};
    private nodes: Record<string, ActNode> = {};
    private edges: Array<{ source: string; target: string }> = [];
    private env: Record<string, string> = {};
  
    constructor(content: string) {
      this.lines = content.split('\n').map(line => line.trim());
    }
  
    parse(): ActWorkflow {
      for (const line of this.lines) {
        if (line === '' || line.startsWith('#')) continue;
        
        if (line.startsWith('[') && line.endsWith(']')) {
          this.handleSectionStart(line);
        } else if (line.includes('=')) {
          this.handleKeyValuePair(line);
        }
      }
  
      return {
        workflow_id: this.workflow.workflow_id || '',
        name: this.workflow.name || 'Untitled Workflow',
        description: this.workflow.description || '',
        start_node: this.workflow.start_node || '',
        nodes: this.nodes,
        edges: this.edges,
        env: this.env
      };
    }
  
    private handleSectionStart(line: string) {
      const section = line.slice(1, -1);
      if (section.startsWith('node:')) {
        if (this.currentNode.id) {
          this.nodes[this.currentNode.id] = this.currentNode as ActNode;
        }
        this.currentNode = {
          id: section.split(':')[1],
          node_type: 'APP NAME'
        };
      }
      this.currentSection = section;
    }
  
    private handleKeyValuePair(line: string) {
      const [key, value] = line.split('=').map(part => part.trim());
      
      switch (this.currentSection) {
        case 'workflow':
          this.workflow[key as keyof ActWorkflow] = this.parseValue(value);
          break;
        case this.currentSection.startsWith('node:') ? this.currentSection : '':
          this.currentNode[key as keyof ActNode] = this.parseValue(value);
          break;
        case 'edges':
          this.edges.push({
            source: key,
            target: this.parseValue(value)
          });
          break;
        case 'env':
          this.env[key] = this.parseValue(value);
          break;
      }
    }
  
    private parseValue(value: string): any {
      if (value.startsWith('{') && value.endsWith('}')) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1);
      }
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (!isNaN(Number(value))) return Number(value);
      return value;
    }
  }