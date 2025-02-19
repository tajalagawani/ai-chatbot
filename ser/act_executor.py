import tempfile
import os
import asyncio
from act import ExecutionManager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ActContentExecutor:
    def __init__(self, act_content: str):
        self.act_content = act_content
        self.temp_file = None
        
    async def execute(self):
        try:
            # Create temp file with ACT content
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.act') as temp_file:
                temp_file.write(self.act_content)
                self.temp_file = temp_file.name
            
            logger.info(f"Created temporary file: {self.temp_file}")

            # Run execution in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            execution_manager = ExecutionManager(self.temp_file)
            
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
            if self.temp_file and os.path.exists(self.temp_file):
                try:
                    os.unlink(self.temp_file)
                    logger.info(f"Cleaned up temporary file: {self.temp_file}")
                except Exception as e:
                    logger.error(f"Error cleaning up temporary file: {str(e)}")