import os
import json
import time
import logging
import threading
import subprocess
import io
import sys
from queue import Queue
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List, Deque
from collections import deque
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from act_executor import ActContentExecutor

# Configure logging with custom handler to capture logs in memory
class MemoryLogHandler(logging.Handler):
    def __init__(self, max_lines=2000):
        super().__init__()
        self.log_buffer = deque(maxlen=max_lines)
        self.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        
    def emit(self, record):
        try:
            log_entry = self.format(record)
            self.log_buffer.append(log_entry)
        except Exception:
            self.handleError(record)
            
memory_handler = MemoryLogHandler()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        memory_handler
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Attach log buffer to app for access in endpoint
app.log_buffer = memory_handler.log_buffer

# Store execution history for log access
execution_history = {}
app.execution_history = execution_history

# Get environment variables
PORT = int(os.environ.get('PORT', 5002))
ARTIFACT_ID = os.environ.get('ARTIFACT_ID')

@dataclass
class ExecutionInfo:
    id: str
    status: str
    start_time: float
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    logs: List[Dict[str, Any]] = None
    current_node: Optional[str] = None
    node_status: Dict[str, str] = field(default_factory=dict)
    executed_nodes: List[str] = field(default_factory=list)
    executor: Any = None  # Add this field to store the executor reference


    def __post_init__(self):
        if self.logs is None:
            self.logs = []

# Execution tracking
active_executions: Dict[str, ExecutionInfo] = {}
execution_queue = Queue()
execution_lock = threading.Lock()

# Initialize executor with node progress tracking
class NodeTrackingExecutor(ActContentExecutor):
    def __init__(self):
        super().__init__()
        
    def on_node_start(self, node_id, execution_id):
        """Track when a node starts executing"""
        with execution_lock:
            if execution_id in active_executions:
                active_executions[execution_id].current_node = node_id
                active_executions[execution_id].node_status[node_id] = 'executing'
                
                # Add to executed nodes list if not already there
                if node_id not in active_executions[execution_id].executed_nodes:
                    active_executions[execution_id].executed_nodes.append(node_id)
                    
                logger.info(f"Execution {execution_id}: Node {node_id} started")
                add_execution_log(execution_id, 'running', f"Node {node_id} started execution")
    
    def on_node_complete(self, node_id, execution_id, success=True):
        """Track when a node completes execution"""
        with execution_lock:
            if execution_id in active_executions:
                active_executions[execution_id].node_status[node_id] = 'completed' if success else 'failed'
                
                # Only clear current_node if it matches the completed node
                if active_executions[execution_id].current_node == node_id:
                    active_executions[execution_id].current_node = None
                    
                status = 'completed' if success else 'failed'
                logger.info(f"Execution {execution_id}: Node {node_id} {status}")
                add_execution_log(execution_id, status, f"Node {node_id} {status}")
    
    def execute(self, content, execution_id=None):
        """Override execute to track node progress"""
        if not execution_id:
            return super().execute(content)
            
        # Parse the ACT content to get node IDs
        try:
            nodes = self.parse_act_nodes(content)
            
            # Initialize node status for all nodes
            with execution_lock:
                if execution_id in active_executions:
                    for node_id in nodes:
                        active_executions[execution_id].node_status[node_id] = 'pending'
                        
            # Execute with node tracking
            self.on_node_start(nodes[0], execution_id)  # Start with first node
            result = super().execute(content)
            
            # Mark all nodes as completed
            with execution_lock:
                if execution_id in active_executions:
                    for node_id in nodes:
                        if node_id not in active_executions[execution_id].node_status or \
                           active_executions[execution_id].node_status[node_id] != 'completed':
                            active_executions[execution_id].node_status[node_id] = 'completed'
                    
                    # Clear current node
                    active_executions[execution_id].current_node = None
                    
            return result
            
        except Exception as e:
            # If error occurs, mark current node as failed
            with execution_lock:
                if execution_id in active_executions and active_executions[execution_id].current_node:
                    node_id = active_executions[execution_id].current_node
                    self.on_node_complete(node_id, execution_id, success=False)
            raise e
            
    def parse_act_nodes(self, content):
        """Parse node IDs from ACT content"""
        nodes = []
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('[node:'):
                # Extract node ID from section header like [node:node_id]
                node_id = line[6:-1]  # Remove [node: and ]
                nodes.append(node_id)
                
        return nodes

# Use our tracking executor
executor = NodeTrackingExecutor()

def add_execution_log(exec_id, status, message):
    """Add log entry to execution history"""
    if exec_id not in execution_history:
        execution_history[exec_id] = []
        
    execution_history[exec_id].append({
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'status': status,
        'message': message
    })

def cleanup_old_executions():
    """Clean up completed executions older than 1 hour."""
    current_time = time.time()
    with execution_lock:
        for exec_id in list(active_executions.keys()):
            execution = active_executions[exec_id]
            if execution.status in ['completed', 'failed'] and \
               (current_time - execution.start_time) > 3600:  # 1 hour
                del active_executions[exec_id]
                
                # Keep execution history even after removing from active
                if len(execution_history) > 20:  # Limit history to last 20 executions
                    oldest_exec = sorted(execution_history.keys())[0]
                    del execution_history[oldest_exec]

def make_json_serializable(obj):
    """Recursively convert objects to JSON serializable types."""
    if obj is None:
        return None
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif isinstance(obj, tuple):
        return [make_json_serializable(item) for item in obj]
    elif str(type(obj)).find('GenerateContentResponse') > -1:
        # Special handling for Gemini responses
        try:
            # Try different ways to extract text
            if hasattr(obj, 'candidates') and obj.candidates:
                # Typical structure for Gemini response
                for candidate in obj.candidates:
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        for part in candidate.content.parts:
                            if hasattr(part, 'text') and part.text:
                                return {"text": part.text, "type": "gemini_response"}
            
            # If we couldn't extract using the object structure, try common attributes
            if hasattr(obj, 'text'):
                return {"text": obj.text, "type": "gemini_response"}
            elif hasattr(obj, 'result_text'):
                return {"text": obj.result_text, "type": "gemini_response"}
            
            # Last resort: stringify the whole object
            return {"text": str(obj), "type": "gemini_response"}
        except Exception as e:
            logger.error(f"Error serializing Gemini response: {e}")
            return {"text": "Error processing Gemini response", "type": "gemini_response"}
    else:
        # For any other object, convert to string
        return str(obj)

def resolve_node_references(all_node_results, current_scope):
    """Recursively resolve placeholder references between nodes in the results dictionary."""
    if not isinstance(current_scope, dict):
        return
    
    # Check each node result in the current scope
    for key, value in current_scope.items():
        if isinstance(value, dict):
            # For dictionaries, check for references and recursively process
            resolve_node_references(all_node_results, value)
            
            # Check specifically for 'value' field in set node results
            if 'key' in value and 'value' in value:
                val = value['value']
                if isinstance(val, str) and val.startswith('{{') and val.endswith('}}'):
                    # This looks like an unresolved placeholder
                    placeholder = val[2:-2].strip()  # Remove {{ }}
                    
                    # Split into node name and path
                    parts = placeholder.split('.')
                    if len(parts) >= 2:
                        node_name = parts[0]
                        path = '.'.join(parts[1:])
                        
                        # Try to resolve from the all_node_results
                        if node_name in all_node_results:
                            node_data = all_node_results[node_name]
                            
                            # Navigate the path
                            current = node_data
                            path_parts = path.split('.')
                            resolved = True
                            
                            for part in path_parts:
                                if isinstance(current, dict) and part in current:
                                    current = current[part]
                                else:
                                    # Path not found
                                    resolved = False
                                    break
                            
                            if resolved:
                                # Successfully resolved the reference
                                value['value'] = current
                                value['resolved_from_placeholder'] = val
        
        elif isinstance(value, list):
            # For lists, process each item
            for item in value:
                if isinstance(item, dict):
                    resolve_node_references(all_node_results, item)

def process_result_for_output(result):
    """Process the result dictionary to make it JSON serializable and resolve placeholders."""
    # First, make everything JSON serializable
    serializable_result = make_json_serializable(result)
    
    # Then resolve any placeholder references between nodes
    if isinstance(serializable_result, dict) and 'results' in serializable_result:
        node_results = serializable_result.get('results', {})
        resolve_node_references(node_results, node_results)
        
    return serializable_result

def process_execution_queue():
    """Process queued executions."""
    while True:
        try:
            # Get next execution from queue
            exec_id, content = execution_queue.get()
            
            if exec_id not in active_executions:
                continue
                
            execution = active_executions[exec_id]
            
            try:
                # Log start
                logger.info(f"Starting execution {exec_id}")
                add_execution_log(exec_id, 'running', f"Starting execution with {len(content)} characters")
                
                # Update status
                with execution_lock:
                    execution.status = 'running'
                
                # Execute workflow with node tracking
                result = executor.execute(content, execution_id=exec_id)
                
                with execution_lock:
                    execution.status = 'completed'
                    execution.result = result
                    execution.current_node = None  # Clear current node
                    
                # Log completion
                logger.info(f"Execution {exec_id} completed successfully")
                add_execution_log(exec_id, 'completed', f"Execution completed: {result.get('status', 'No status')}")
                    
            except Exception as e:
                logger.error(f"Execution {exec_id} failed: {e}")
                add_execution_log(exec_id, 'failed', f"Execution failed: {str(e)}")
                
                with execution_lock:
                    execution.status = 'failed'
                    execution.error = str(e)
                    execution.current_node = None  # Clear current node
                    
        except Exception as e:
            logger.error(f"Error in queue processor: {e}")
            
        finally:
            execution_queue.task_done()
            cleanup_old_executions()

# Start queue processor thread
queue_processor = threading.Thread(target=process_execution_queue, daemon=True)
queue_processor.start()


@app.route('/execute', methods=['POST'])
def execute_workflow():
    """Execute ACT workflow."""
    try:
        data = request.json
        if not data or 'content' not in data:
            return jsonify({
                'status': 'error',
                'error': 'Missing workflow content'
            }), 400

        # Generate execution ID
        import uuid
        exec_id = str(uuid.uuid4())
        
        # Register execution
        with execution_lock:
            active_executions[exec_id] = ExecutionInfo(
                id=exec_id,
                status='queued',
                start_time=time.time()
            )
        
        # Log queuing
        logger.info(f"Queued execution {exec_id}")
        add_execution_log(exec_id, 'queued', "Workflow queued for execution")
        
        # Add to execution queue
        execution_queue.put((exec_id, data['content']))
        
        # Initial response
        return jsonify({
            'status': 'accepted',
            'execution_id': exec_id,
            'message': 'Workflow queued for execution'
        })

    except Exception as e:
        logger.error(f"Unexpected error in execute_workflow: {e}")
        return jsonify({
            'status': 'error',
            'error': f"Unexpected error: {str(e)}"
        }), 500

@app.route('/status/<execution_id>')
def execution_status(execution_id):
    """Get status of a specific execution with node tracking."""
    try:
        execution = active_executions.get(execution_id)
        if not execution:
            return jsonify({
                'status': 'error',
                'error': 'Execution not found'
            }), 404
        
        # Basic response with execution status
        response = {
            'execution_id': execution.id,
            'status': execution.status,
            'start_time': execution.start_time
        }
        
        # If executor is accessible, get detailed node status
        executor = getattr(execution, 'executor', None)
        if executor and hasattr(executor, 'get_execution_status'):
            try:
                # Get detailed status including current node and node statuses
                detailed_status = executor.get_execution_status()
                response['current_node'] = detailed_status.get('current_node')
                response['executed_nodes'] = detailed_status.get('executed_nodes', [])
                response['node_status'] = detailed_status.get('node_status', {})
            except Exception as e:
                logger.warning(f"Could not get detailed execution status: {e}")
        
        # Add execution result if completed
        if execution.status == 'completed' and execution.result:
            # Process to make JSON serializable and resolve references
            serializable_result = process_result_for_output(execution.result)
            response['result'] = serializable_result
        elif execution.status == 'failed':
            response['error'] = execution.error
            
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error getting execution status: {e}")
        return jsonify({
            'status': 'error',
            'error': f"Failed to get status: {str(e)}"
        }), 500

@app.route('/logs', methods=['GET'])
def get_logs():
    """Return raw container logs with minimal formatting."""
    try:
        # Option 1: Get logs from Docker directly (most reliable)
        try:
            # Get the container ID from hostname
            container_id = os.environ.get('HOSTNAME', '')
            if container_id:
                # Use subprocess to get raw container logs
                result = subprocess.run(
                    ['tail', '-n', '1000', '/proc/1/fd/1', '/proc/1/fd/2'], 
                    capture_output=True, 
                    text=True
                )
                return Response(result.stdout + result.stderr, mimetype='text/plain')
        except Exception as e:
            logger.error(f"Error getting direct logs: {e}")
            
        # Option 2: Get logs from memory buffer
        if hasattr(app, 'log_buffer') and app.log_buffer:
            logs = list(app.log_buffer)
            return Response("\n".join(logs), mimetype='text/plain')
            
        # Option 3: Return execution history
        if hasattr(app, 'execution_history') and app.execution_history:
            logs = []
            for exec_id, history in app.execution_history.items():
                for entry in history:
                    logs.append(f"{entry.get('timestamp', '')} - Execution {exec_id} - {entry.get('status', '')} - {entry.get('message', '')}")
            return Response("\n".join(logs), mimetype='text/plain')

        # Option 4: Return basic system info if nothing else is available
        system_info = [
            f"Container ID: {os.environ.get('HOSTNAME', 'unknown')}",
            f"Artifact ID: {os.environ.get('ARTIFACT_ID', 'unknown')}",
            f"Start time: {time.ctime(os.path.getctime('/proc/1'))}",
            f"Current time: {time.ctime()}",
            f"Python version: {sys.version}",
            f"OS: {sys.platform}",
            "No logs available. Container might be newly started."
        ]
        return Response("\n".join(system_info), mimetype='text/plain')
            
    except Exception as e:
        error_message = f"Error retrieving logs: {str(e)}\n"
        return Response(error_message, mimetype='text/plain')
    
@app.route('/health')
def health_check():
    """Enhanced health check endpoint with detailed worker status."""
    try:
        # Get system metrics
        import psutil
        import os
        import time
        import sys
        
        # Calculate uptime
        start_time = os.path.getctime('/proc/1')
        uptime_seconds = time.time() - start_time
        hours, remainder = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        
        # Get memory usage
        memory = psutil.virtual_memory()
        memory_used_mb = memory.used / (1024 * 1024)
        memory_total_mb = memory.total / (1024 * 1024)
        memory_percent = memory.percent
        
        # Get CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Get disk usage
        disk = psutil.disk_usage('/')
        disk_used_gb = disk.used / (1024 * 1024 * 1024)
        disk_total_gb = disk.total / (1024 * 1024 * 1024)
        disk_percent = disk.percent
        
        # Get execution stats
        active_count = len(active_executions)
        completed_count = sum(1 for exec_info in active_executions.values() 
                             if exec_info.status in ['completed', 'failed'])
        pending_count = active_count - completed_count
        queue_size = execution_queue.qsize()
        
        # Check if any recent executions have failed
        has_recent_failures = any(
            exec_info.status == 'failed' and (time.time() - exec_info.start_time) < 600  # Last 10 minutes
            for exec_info in active_executions.values()
        )
        
        return jsonify({
            'status': 'healthy',
            'service': f'workflow-worker-{ARTIFACT_ID}',
            'container_id': os.environ.get('HOSTNAME', 'unknown'),
            'port': PORT,
            
            # Execution stats
            'executions': {
                'active': active_count,
                'completed': completed_count,
                'pending': pending_count,
                'queue_size': queue_size,
                'has_recent_failures': has_recent_failures
            },
            
            # System stats
            'system': {
                'uptime': {
                    'hours': int(hours),
                    'minutes': int(minutes),
                    'seconds': int(seconds),
                    'total_seconds': int(uptime_seconds)
                },
                'memory': {
                    'used_mb': round(memory_used_mb, 1),
                    'total_mb': round(memory_total_mb, 1),
                    'percent': memory_percent
                },
                'cpu': {
                    'percent': cpu_percent
                },
                'disk': {
                    'used_gb': round(disk_used_gb, 1),
                    'total_gb': round(disk_total_gb, 1),
                    'percent': disk_percent
                },
                'python_version': sys.version
            }
        })
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/node-status/<execution_id>')
def node_status(execution_id):
    """Get detailed node status for an execution."""
    try:
        execution = active_executions.get(execution_id)
        if not execution:
            return jsonify({
                'status': 'error',
                'error': 'Execution not found'
            }), 404
            
        response = {
            'execution_id': execution.id,
            'status': execution.status,
            'current_node': execution.current_node,
            'executed_nodes': execution.executed_nodes,
            'node_status': execution.node_status
        }
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error getting node status: {e}")
        return jsonify({
            'status': 'error',
            'error': f"Failed to get node status: {str(e)}"
        }), 500

if __name__ == '__main__':
    logger.info(f"Starting worker on port {PORT}")
    logger.info(f"Artifact ID: {ARTIFACT_ID}")
    app.run(host='0.0.0.0', port=PORT)