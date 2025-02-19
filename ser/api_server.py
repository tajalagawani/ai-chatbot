# File: ser/api_server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import docker
import logging
import os
from typing import Dict
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize Docker client
docker_client = docker.from_env()

# Store container information
containers: Dict[str, str] = {}

@app.route('/health')
def health_check():
    """Health check endpoint."""
    try:
        docker_client.ping()
        return jsonify({
            'status': 'healthy',
            'service': 'act-executor'
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/container/start', methods=['POST'])
def start_container():
    """Start a new container for an artifact."""
    try:
        data = request.get_json()
        artifact_id = data.get('artifactId')
        
        if not artifact_id:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400

        # Stop existing container if it exists
        if artifact_id in containers:
            try:
                existing_container = docker_client.containers.get(containers[artifact_id])
                existing_container.stop()
                existing_container.remove()
            except:
                pass

        # Create new container
        container = docker_client.containers.run(
            'flow-runner',
            detach=True,
            name=f'flow-{artifact_id}',
            network='act-network'
        )

        containers[artifact_id] = container.id

        return jsonify({
            'status': 'success',
            'containerId': container.id
        })

    except Exception as e:
        logger.error(f"Error starting container: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/container/stop', methods=['POST'])
def stop_container():
    """Stop a container for an artifact."""
    try:
        data = request.get_json()
        artifact_id = data.get('artifactId')
        
        if not artifact_id:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400

        if artifact_id in containers:
            container_id = containers[artifact_id]
            try:
                container = docker_client.containers.get(container_id)
                container.stop()
                container.remove()
                del containers[artifact_id]
            except:
                pass

        return jsonify({
            'status': 'success'
        })

    except Exception as e:
        logger.error(f"Error stopping container: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/container/execute', methods=['POST'])
def execute_workflow():
    """Execute workflow in a specific container."""
    try:
        data = request.get_json()
        artifact_id = data.get('artifactId')
        content = data.get('content')
        
        if not artifact_id or not content:
            return jsonify({
                'status': 'error',
                'error': 'Missing required parameters'
            }), 400

        if artifact_id not in containers:
            return jsonify({
                'status': 'error',
                'error': 'Container not found'
            }), 404

        container_id = containers[artifact_id]
        container = docker_client.containers.get(container_id)

        # Execute workflow in container
        exec_result = container.exec_run(
            cmd=['python', 'flow_runner.py'],
            environment={'FLOW_CONTENT': json.dumps(content)}
        )

        return jsonify({
            'status': 'success',
            'result': exec_result.output.decode()
        })

    except Exception as e:
        logger.error(f"Error executing workflow: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/container/health', methods=['POST'])
def check_container_health():
    """Check health of a specific container."""
    try:
        data = request.get_json()
        artifact_id = data.get('artifactId')
        
        if not artifact_id:
            return jsonify({
                'status': 'error',
                'error': 'Missing artifactId'
            }), 400

        if artifact_id not in containers:
            return jsonify({
                'status': 'stopped'
            })

        container_id = containers[artifact_id]
        container = docker_client.containers.get(container_id)

        return jsonify({
            'status': container.status
        })

    except Exception as e:
        logger.error(f"Error checking container health: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)