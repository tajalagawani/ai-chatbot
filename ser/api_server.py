from flask import Flask, request, jsonify
from act_executor import ActContentExecutor
import logging
import os
from flask_cors import CORS
import asyncio
from functools import wraps
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Store event loop for each thread
thread_local = threading.local()

def get_event_loop():
    """Get or create event loop for current thread."""
    if not hasattr(thread_local, 'loop'):
        thread_local.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(thread_local.loop)
    return thread_local.loop

def async_route(f):
    """Decorator to handle async routes."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        loop = get_event_loop()
        try:
            return loop.run_until_complete(f(*args, **kwargs))
        except Exception as e:
            logger.error(f"Error in async route: {str(e)}")
            return jsonify({
                'status': 'error',
                'error': str(e)
            }), 500
    return wrapper

@app.route('/health')
def health_check():
    """Health check endpoint."""
    try:
        # Verify event loop is working
        loop = get_event_loop()
        return jsonify({
            'status': 'healthy',
            'service': 'act-executor',
            'event_loop': 'working'
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/execute', methods=['POST'])
@async_route
async def execute_workflow():
    """Execute ACT workflow endpoint."""
    try:
        data = request.get_json()
        if not data or 'content' not in data:
            logger.error("No ACT content provided")
            return jsonify({
                'status': 'error',
                'error': 'No ACT content provided'
            }), 400

        logger.info("Starting workflow execution")
        executor = ActContentExecutor(data['content'])
        result = await executor.execute()
        
        logger.info("Workflow execution completed")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Error executing workflow: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

def cleanup():
    """Cleanup function to close event loops."""
    if hasattr(thread_local, 'loop'):
        loop = thread_local.loop
        if loop.is_running():
            loop.stop()
        if not loop.is_closed():
            loop.close()

@app.before_first_request
def before_first_request():
    """Initialize the application before first request."""
    # Set up event loop for main thread
    get_event_loop()

@app.teardown_appcontext
def teardown_appcontext(exception=None):
    """Clean up when the application context ends."""
    cleanup()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    
    # Configure threaded operation
    app.run(
        host='0.0.0.0', 
        port=port,
        threaded=True  # Enable threading
    )