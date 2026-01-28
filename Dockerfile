FROM python:3.11-slim

WORKDIR /app

# Install dependencies from requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all content (respecting .dockerignore)
COPY . /app/

# Expose single port (HTTP + WebSocket unified)
EXPOSE 8888

# Run server
CMD ["python3", "servidor.py"]
