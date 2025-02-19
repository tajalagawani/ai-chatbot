import os
import sys
import json
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FlowRunner:
    def __init__(self, flow_content: Dict[str, Any]):
        self.flow_content = flow_content
        self.flow_id = flow_content.get('workflow', {}).get('workflow_id')
        
    def execute(self):
        try:
            logger.info(f"Starting execution of flow {self.flow_id}")
            
            # Get nodes and their connections
            nodes = self.flow_content.get('nodes', {})
            edges = self.flow_content.get('edges', [])
            
            # Execute nodes in order based on edges
            execution_order = self._determine_execution_order(nodes, edges)
            
            results = {}
            for node_id in execution_order:
                node = nodes[node_id]
                logger.info(f"Executing node: {node_id}")
                result = self._execute_node(node)
                results[node_id] = result
                
            return {
                "status": "success",
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Flow execution failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _determine_execution_order(self, nodes, edges):
        # Implement topological sort based on edges
        # This is a simplified version - you'd want more robust logic
        visited = set()
        order = []
        
        def visit(node_id):
            if node_id in visited:
                return
            visited.add(node_id)
            # Find children
            children = [edge['target'] for edge in edges if edge['source'] == node_id]
            for child in children:
                visit(child)
            order.append(node_id)
            
        # Start with nodes that have no incoming edges
        start_nodes = set(nodes.keys()) - set(edge['target'] for edge in edges)
        for node_id in start_nodes:
            visit(node_id)
            
        return list(reversed(order))
    
    def _execute_node(self, node):
        # Implement node execution logic based on node type
        node_type = node.get('type')
        operation = node.get('operation')
        params = node.get('params', {})
        
        logger.info(f"Executing {node_type} operation: {operation}")
        # Add your node execution logic here
        
        return {
            "status": "completed",
            "output": f"Executed {operation} with params {params}"
        }

if __name__ == "__main__":
    # Read flow content from environment variable or file
    flow_content = json.loads(os.environ.get('FLOW_CONTENT', '{}'))
    
    runner = FlowRunner(flow_content)
    result = runner.execute()
    
    # Output results in a format that can be captured by the executor
    print(json.dumps(result))