# Base Python Service Dockerfile
# File: base.Dockerfile
FROM python:3.9-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY ser/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
