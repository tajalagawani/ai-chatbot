FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY act_executor.py .
COPY api_server.py .

EXPOSE 5001
CMD ["python", "api_server.py"]