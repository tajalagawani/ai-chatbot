# Dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy your Flask app files and act_executor.py first
COPY app.py /app/
COPY act_executor.py /app/

# Copy requirements file
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/tmp

# Expose API port
EXPOSE 5001

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV EXECUTION_TIMEOUT=300
ENV FLASK_APP=app.py

# Run the Flask app directly
CMD ["python", "app.py"]