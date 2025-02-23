import tempfile
import os
import asyncio
from act import ExecutionManager
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActContentExecutor:
    def __init__(self):
        self.executions = {}

    def execute(self, content: str) -> Dict[str, Any]:
        """Execute ACT workflow content."""
        try:
            # Create event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Execute async workflow
            return loop.run_until_complete(self._execute_async(content))
        finally:
            loop.close()

    async def _execute_async(self, content: str) -> Dict[str, Any]:
        temp_file = None
        try:
            # Create temp file with ACT content
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.act') as temp_file:
                temp_file.write(content)
                temp_file_path = temp_file.name
            
            logger.info(f"Created temporary file: {temp_file_path}")

            # Run execution in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            execution_manager = ExecutionManager(temp_file_path)
            
            result = await loop.run_in_executor(
                None, 
                execution_manager.execute_workflow
            )
            
            logger.info("Workflow execution completed successfully")
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error during workflow execution: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
            
        finally:
            # Cleanup temp file
            if temp_file and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                    logger.info(f"Cleaned up temporary file: {temp_file_path}")
                except Exception as e:
                    logger.error(f"Error cleaning up temporary file: {str(e)}")

    def cleanup(self):
        """Cleanup executor resources."""
        pass  # Add any cleanup if needed