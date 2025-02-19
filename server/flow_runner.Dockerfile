FROM python:3.9-slim

WORKDIR /app

COPY ser/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the flow runner script
COPY ser/flow_runner.py .

# This will be the entry point for running individual flows
ENTRYPOINT ["python", "flow_runner.py"]
