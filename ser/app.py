import os
import logging
import docker
from typing import Dict, Optional, Any
from dataclasses import dataclass
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize Docker client
try:
    docker_client = docker.from_env()
    logger.info("Docker client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Docker client: {e}")
    docker_client = None

@dataclass
class ContainerInfo:
    artifact_id: str
    container_id: str
    port: int
    status: str = 'starting'
    start_time: float = 0.0
    last_health_check: float = 0.0
    health_status: str = 'unknown'
    error: Optional[str] = None

# Container tracking
containers: Dict[str, ContainerInfo] = {}
active_ports: Dict[int, str] = {}  # port -> artifact_id mapping

# Base port range
BASE_PORT = 5002
MAX_PORT = 5050

def find_available_port() -> int:
    """Find an available port within the range."""
    for port in range(BASE_PORT, MAX_PORT + 1):
        if port not in active_ports:
            return port
    raise RuntimeError("No available ports in the specified range")

def create_docker_container(artifact_id: str, port: int) -> tuple[str, int]:
    """Create and start a new Docker container."""
    container_name = f"workflow-{artifact_id}"
    
    try:
        # Check for and remove existing container with same name
        try:
            old_container = docker_client.containers.get(container_name)
            logger.info(f"Found existing container {container_name}, stopping it")
            old_container.stop()
            old_container.remove()
            logger.info(f"Removed existing container: {container_name}")
        except docker.errors.NotFound:
            pass

        logger.info(f"Creating new container {container_name} on port {port}")
        # Create container with dynamic port binding
        container = docker_client.containers.run(
            image="workflow-worker:latest",
            name=container_name,
            detach=True,
            network="workflow-net",
            environment={
                "PORT": str(port),
                "ARTIFACT_ID": artifact_id,
            },
            ports={f"{port}/tcp": port},  # Explicitly bind to the same port number
            volumes={
                "/tmp": {"bind": "/tmp", "mode": "rw"}
            },
            restart_policy={"Name": "unless-stopped"}
        )

        # Get container info with error handling
        container_info = docker_client.api.inspect_container(container.id)
        port_mappings = container_info['NetworkSettings']['Ports']
        
        # More defensive port extraction
        if f'{port}/tcp' in port_mappings and port_mappings[f'{port}/tcp']:
            host_port = int(port_mappings[f'{port}/tcp'][0]['HostPort'])
            logger.info(f"Container port {port} mapped to host port {host_port}")
        else:
            host_port = port  # Fallback to the original port if mapping not found
            logger.warning(f"Could not find port mapping, using original port {port}")
        
        logger.info(f"Container created: {container_name} on port {host_port}")
        return container.id, host_port

    except Exception as e:
        logger.error(f"Error creating container: {e}")
        # Log more details about the error
        logger.error(f"Error details: {str(e)}")
        raise

@app.route('/health')
def health_check():
    """Health check endpoint for the manager service."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        # Check Docker service
        try:
            docker_info = docker_client.info()
            docker_status = 'healthy'
        except Exception as docker_error:
            docker_status = 'error'
            logger.error(f"Docker health check failed: {docker_error}")
        
        return jsonify({
            'status': 'healthy',
            'service': 'workflow-manager',
            'docker_status': docker_status,
            'containers': len(containers),
            'active_ports': len(active_ports),
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/container/start', methods=['POST'])
def start_container():
    """Start a new Docker container for the given artifact."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        data = request.json
        if not data or 'artifactId' not in data:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400
        
        artifact_id = data['artifactId']
        logger.info(f"Requested container start for artifact: {artifact_id}")
        
        # If container already exists and is running, return it
        if artifact_id in containers:
            existing_container = containers[artifact_id]
            try:
                # Verify container is actually running
                container = docker_client.containers.get(existing_container.container_id)
                if container.status == 'running':
                    logger.info(f"Container for artifact {artifact_id} is already running")
                    return jsonify({
                        'status': 'success',
                        'message': 'Container already running',
                        'containerId': existing_container.container_id,
                        'port': existing_container.port
                    })
            except docker.errors.NotFound:
                # Container doesn't exist anymore, remove from tracking
                logger.warning(f"Tracked container {existing_container.container_id} not found in Docker, removing from tracking")
                if existing_container.port in active_ports:
                    del active_ports[existing_container.port]
                del containers[artifact_id]
                
        # Find next available port
        port_search_attempts = 0
        for port in range(BASE_PORT, BASE_PORT + 100):
            port_search_attempts += 1
            try:
                logger.info(f"Attempting to create container on port {port} (attempt {port_search_attempts})")
                container_id, host_port = create_docker_container(artifact_id, port)
                
                # Register container and port
                containers[artifact_id] = ContainerInfo(
                    artifact_id=artifact_id,
                    container_id=container_id,
                    port=host_port,
                    status='running',
                    start_time=time.time()
                )
                active_ports[host_port] = artifact_id
                
                logger.info(f"Successfully started container for artifact {artifact_id} on port {host_port}")
                return jsonify({
                    'status': 'success',
                    'containerId': container_id,
                    'port': host_port
                })
                
            except docker.errors.APIError as e:
                if 'port is already allocated' in str(e):
                    logger.warning(f"Port {port} is already allocated, trying next port")
                    continue
                logger.error(f"Docker API error when creating container: {e}")
                raise
                
        logger.error(f"Failed to find available port after {port_search_attempts} attempts")
        raise RuntimeError(f"No available ports in range after {port_search_attempts} attempts")
            
    except Exception as e:
        logger.error(f"Error creating container: {e}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/container/stop', methods=['POST'])
def stop_container():
    """Stop and remove a Docker container."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        data = request.json
        if not data or 'artifactId' not in data:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400
        
        artifact_id = data['artifactId']
        logger.info(f"Requested container stop for artifact: {artifact_id}")
        
        if artifact_id not in containers:
            logger.info(f"Container for artifact {artifact_id} not found or already stopped")
            return jsonify({
                'status': 'success',
                'message': 'Container not found or already stopped'
            })
        
        container_info = containers[artifact_id]
        
        try:
            # Get and stop container
            logger.info(f"Stopping container {container_info.container_id}")
            container = docker_client.containers.get(container_info.container_id)
            container.stop(timeout=10)
            container.remove(force=True)
            logger.info(f"Container {container_info.container_id} stopped and removed")
            
            # Remove from tracking
            if container_info.port in active_ports:
                del active_ports[container_info.port]
            del containers[artifact_id]
            
            return jsonify({
                'status': 'success',
                'message': 'Container stopped and removed successfully'
            })
            
        except docker.errors.NotFound:
            # Container already removed
            logger.warning(f"Container {container_info.container_id} not found, probably already removed")
            if container_info.port in active_ports:
                del active_ports[container_info.port]
            del containers[artifact_id]
            
            return jsonify({
                'status': 'success',
                'message': 'Container not found or already removed'
            })
            
    except Exception as e:
        logger.error(f"Unexpected error in stop_container: {e}")
        return jsonify({
            'status': 'error',
            'error': f"Unexpected error: {str(e)}"
        }), 500

@app.route('/container/health', methods=['POST'])
def container_health():
    """Check health of a specific container with detailed status."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        data = request.json
        if not data or 'artifactId' not in data:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400
        
        artifact_id = data['artifactId']
        logger.debug(f"Checking health for container with artifact ID: {artifact_id}")
        
        if artifact_id not in containers:
            return jsonify({
                'status': 'stopped',
                'message': 'Container not found'
            })
        
        container_info = containers[artifact_id]
        now = time.time()
        
        try:
            # Check container existence first
            try:
                container = docker_client.containers.get(container_info.container_id)
            except docker.errors.NotFound:
                # Container not found in Docker
                logger.warning(f"Container {container_info.container_id} not found in Docker")
                if container_info.port in active_ports:
                    del active_ports[container_info.port]
                del containers[artifact_id]
                
                return jsonify({
                    'status': 'stopped',
                    'message': 'Container not found in Docker'
                })
            
            # Get detailed container inspection data
            inspect_data = docker_client.api.inspect_container(container_info.container_id)
            
            # Extract container state
            container_state = {
                'status': inspect_data['State']['Status'],
                'running': inspect_data['State']['Running'],
                'paused': inspect_data['State']['Paused'],
                'restarting': inspect_data['State']['Restarting'],
                'startedAt': inspect_data['State']['StartedAt'],
                'finishedAt': inspect_data['State']['FinishedAt'],
                'exitCode': inspect_data['State']['ExitCode'],
                'error': inspect_data['State']['Error'],
            }
            
            # Include health check data if available
            if 'Health' in inspect_data['State']:
                container_state['health'] = {
                    'status': inspect_data['State']['Health']['Status'],
                    'failingStreak': inspect_data['State']['Health']['FailingStreak'],
                    'log': inspect_data['State']['Health']['Log']
                }
            
            # Check if container is actually running
            if not container_state['running']:
                logger.warning(f"Container {container_info.container_id} is not running: {container_state['status']}")
                containers[artifact_id].status = 'stopped'
                containers[artifact_id].health_status = 'stopped'
                containers[artifact_id].last_health_check = now
                
                return jsonify({
                    'status': 'stopped',
                    'message': f"Container is {container_state['status']}",
                    'state': container_state
                })
            
            # Try to connect to the health endpoint 
            try:
                logger.debug(f"Checking container health on port {container_info.port}")
                health_response = requests.get(
                    f"http://localhost:{container_info.port}/health",
                    timeout=2
                )
                
                if health_response.status_code == 200:
                    # Combine Docker state with worker health data
                    worker_health = health_response.json()
                    logger.debug(f"Health check successful: {worker_health.get('status', 'unknown')}")
                    
                    # Update container info
                    containers[artifact_id].status = 'running'
                    containers[artifact_id].health_status = worker_health.get('status', 'unknown')
                    containers[artifact_id].last_health_check = now
                    containers[artifact_id].error = None
                    
                    return jsonify({
                        'status': 'running',
                        'containerId': container_info.container_id,
                        'port': container_info.port,
                        'state': container_state,
                        'worker': worker_health
                    })
                else:
                    # Worker responding but unhealthy
                    error_msg = f"Worker health check failed with status {health_response.status_code}"
                    logger.warning(error_msg)
                    
                    # Update container info
                    containers[artifact_id].status = 'error'
                    containers[artifact_id].health_status = 'error'
                    containers[artifact_id].last_health_check = now
                    containers[artifact_id].error = error_msg
                    
                    return jsonify({
                        'status': 'error',
                        'error': error_msg,
                        'containerId': container_info.container_id,
                        'port': container_info.port,
                        'state': container_state
                    })
                    
            except requests.exceptions.RequestException as e:
                # Worker not responding
                error_msg = f"Failed to connect to worker: {str(e)}"
                logger.warning(error_msg)
                
                # Update container info
                containers[artifact_id].status = 'error'
                containers[artifact_id].health_status = 'unreachable'
                containers[artifact_id].last_health_check = now
                containers[artifact_id].error = error_msg
                
                return jsonify({
                    'status': 'error',
                    'error': error_msg,
                    'containerId': container_info.container_id,
                    'port': container_info.port,
                    'state': container_state
                })
                
        except docker.errors.APIError as docker_error:
            # Docker API error
            error_msg = f"Docker API error: {str(docker_error)}"
            logger.error(error_msg)
            return jsonify({
                'status': 'error',
                'error': error_msg
            })
            
        except Exception as e:
            error_msg = f"Failed to check container health: {str(e)}"
            logger.error(error_msg)
            return jsonify({
                'status': 'error',
                'error': error_msg
            })
            
    except Exception as e:
        error_msg = f"Unexpected error in container_health: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'error': error_msg
        }), 500

@app.route('/container/logs/<artifact_id>', methods=['GET'])
def get_container_logs(artifact_id):
    """Get raw logs from a specific container without formatting."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        if not artifact_id or artifact_id not in containers:
            logger.warning(f"Logs requested for unknown container: {artifact_id}")
            return jsonify({
                'status': 'error',
                'error': 'Container not found'
            }), 404
        
        container_info = containers[artifact_id]
        logger.info(f"Fetching logs for container {container_info.container_id}")
        
        try:
            # Get container reference
            container = docker_client.containers.get(container_info.container_id)
            
            # Use Docker SDK to get all available logs
            logs = container.logs(
                stdout=True,
                stderr=True,
                timestamps=False,  # No timestamp prefixes
                tail='all'         # Get all available logs
            ).decode('utf-8', errors='replace')
            
            logger.info(f"Retrieved {len(logs)} bytes of logs from container {container_info.container_id}")
            
            # Return raw logs as plain text
            response = Response(logs, mimetype='text/plain')
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
                
        except docker.errors.NotFound:
            logger.warning(f"Container {container_info.container_id} not found when fetching logs")
            return jsonify({
                'status': 'error',
                'error': 'Container not found'
            }), 404
            
        except Exception as e:
            error_msg = f"Error fetching logs: {str(e)}"
            logger.error(error_msg)
            return jsonify({
                'status': 'error',
                'error': error_msg
            }), 500
            
    except Exception as e:
        error_msg = f"Unexpected error in get_container_logs: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'error': error_msg
        }), 500

@app.route('/container/state/<artifact_id>', methods=['GET'])
def get_container_state(artifact_id):
    """Get detailed container state including logs summary."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        if not artifact_id or artifact_id not in containers:
            logger.warning(f"State requested for unknown container: {artifact_id}")
            return jsonify({
                'status': 'error',
                'error': 'Container not found'
            }), 404
        
        container_info = containers[artifact_id]
        logger.info(f"Fetching state for container {container_info.container_id}")
        
        try:
            # Get container reference
            container = docker_client.containers.get(container_info.container_id)
            
            # Get detailed container inspection data
            inspect_data = docker_client.api.inspect_container(container_info.container_id)
            
            # Extract key state information
            state_data = {
                'status': inspect_data['State']['Status'],
                'running': inspect_data['State']['Running'],
                'paused': inspect_data['State']['Paused'],
                'restarting': inspect_data['State']['Restarting'],
                'startedAt': inspect_data['State']['StartedAt'],
                'finishedAt': inspect_data['State']['FinishedAt'],
                'exitCode': inspect_data['State']['ExitCode'],
                'error': inspect_data['State']['Error'],
                'oomKilled': inspect_data['State']['OOMKilled'],
                'pid': inspect_data['State']['Pid'],
            }
            
            # Include health checks if available
            if 'Health' in inspect_data['State']:
                state_data['health'] = {
                    'status': inspect_data['State']['Health']['Status'],
                    'failingStreak': inspect_data['State']['Health']['FailingStreak'],
                    'log': inspect_data['State']['Health']['Log'][-3:],  # Last 3 health checks
                }
            
            # Include recent logs (last 10 lines)
            try:
                recent_logs = container.logs(
                    stdout=True,
                    stderr=True,
                    tail=10
                ).decode('utf-8', errors='replace').splitlines()
                
                state_data['recent_logs'] = recent_logs
            except Exception as log_error:
                logger.warning(f"Failed to get recent logs: {log_error}")
                state_data['log_error'] = str(log_error)
            
            # Add network settings
            if 'NetworkSettings' in inspect_data and 'Ports' in inspect_data['NetworkSettings']:
                state_data['ports'] = inspect_data['NetworkSettings']['Ports']
            
            # Add basic stats (CPU/memory)
            try:
                stats = container.stats(stream=False)
                if stats:
                    state_data['stats'] = {
                        'cpu_percent': calculate_cpu_percent(stats),
                        'memory_usage': stats['memory_stats'].get('usage', 0),
                        'memory_limit': stats['memory_stats'].get('limit', 0),
                    }
            except Exception as stats_error:
                logger.warning(f"Failed to get container stats: {stats_error}")
                state_data['stats_error'] = str(stats_error)
            
            # Add tracked container info
            state_data['tracked_info'] = {
                'last_health_check': container_info.last_health_check,
                'start_time': container_info.start_time,
                'health_status': container_info.health_status,
                'status': container_info.status,
                'error': container_info.error
            }
                
            return jsonify(state_data)
                
        except docker.errors.NotFound:
            logger.warning(f"Container {container_info.container_id} not found when fetching state")
            return jsonify({
                'status': 'stopped',
                'error': 'Container not found in Docker'
            }), 404
            
        except Exception as e:
            error_msg = f"Error getting container state: {str(e)}"
            logger.error(error_msg)
            return jsonify({
                'status': 'error',
                'error': error_msg
            }), 500
            
    except Exception as e:
        error_msg = f"Unexpected error in get_container_state: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'error': error_msg
        }), 500

def calculate_cpu_percent(stats):
    """Calculate CPU percentage from Docker stats."""
    try:
        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                   stats['precpu_stats']['cpu_usage']['total_usage']
        system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                      stats['precpu_stats']['system_cpu_usage']
        if system_delta > 0 and cpu_delta > 0:
            cpu_count = len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1]))
            return (cpu_delta / system_delta) * cpu_count * 100
        return 0
    except (KeyError, TypeError, ZeroDivisionError) as e:
        logger.warning(f"Error calculating CPU percent: {e}")
        return 0

@app.route('/container/execute', methods=['POST'])
def container_execute():
    """Execute workflow in a specific container."""
    try:
        if docker_client is None:
            return jsonify({
                'status': 'error',
                'error': 'Docker client not initialized'
            }), 500
            
        data = request.json
        if not data or 'artifactId' not in data or 'content' not in data:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId or content'
            }), 400
        
        artifact_id = data['artifactId']
        logger.info(f"Requested workflow execution for artifact: {artifact_id}")
        
        # Get container info
        container_info = containers.get(artifact_id)
        if not container_info:
            logger.warning(f"Container for artifact {artifact_id} not found")
            return jsonify({
                'status': 'error',
                'error': 'Container not found'
            }), 404
            
        if container_info.status != 'running':
            logger.warning(f"Container for artifact {artifact_id} is not running: {container_info.status}")
            return jsonify({
                'status': 'error',
                'error': f'Container is not running: {container_info.status}'
            }), 400

        try:
            # Check container health first
            try:
                health_response = requests.get(
                    f"http://localhost:{container_info.port}/health",
                    timeout=1
                )
                
                if not health_response.ok:
                    logger.warning(f"Container health check failed before execution: {health_response.status_code}")
            except Exception as health_error:
                logger.warning(f"Failed to check container health before execution: {health_error}")
                
            # Forward execution request to worker container
            logger.info(f"Forwarding execution request to container on port {container_info.port}")
            response = requests.post(
                f"http://localhost:{container_info.port}/execute",
                json={'content': data['content']},
                timeout=5
            )
            
            if response.ok:
                result = response.json()
                logger.info(f"Execution request accepted: {result.get('execution_id', 'unknown')}")
                return result
            else:
                error_msg = f'Worker error: {response.text}'
                logger.error(f"Execution request failed: {error_msg}")
                return jsonify({
                    'status': 'error',
                    'error': error_msg
                }), response.status_code
                
        except requests.exceptions.RequestException as e:
            error_msg = f'Failed to execute workflow: {str(e)}'
            logger.error(error_msg)
            return jsonify({
                'status': 'error',
                'error': error_msg
            }), 500
            
    except Exception as e:
        error_msg = f"Execution error: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'error': error_msg
        }), 500

def cleanup_on_shutdown():
    """Clean up all containers on server shutdown."""
    if docker_client is None:
        logger.warning("Cannot clean up containers: Docker client not initialized")
        return
        
    logger.info("Cleaning up containers before shutdown")
    for artifact_id, container_info in list(containers.items()):
        try:
            logger.info(f"Stopping container {container_info.container_id}")
            container = docker_client.containers.get(container_info.container_id)
            container.stop(timeout=10)
            container.remove(force=True)
            logger.info(f"Successfully stopped container {container_info.container_id}")
        except Exception as e:
            logger.error(f"Error cleaning up container {container_info.container_id}: {e}")
    logger.info("Container cleanup completed")

# Register cleanup handler
import atexit
atexit.register(cleanup_on_shutdown)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    logger.info(f"Starting workflow manager on port {port}")
    app.run(host='0.0.0.0', port=port)