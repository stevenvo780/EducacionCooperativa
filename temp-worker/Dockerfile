FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
# - curl, git, wget, nano, vim: Standard tools for a "workspace"
# - python3, python3-pip: For the sync agent
# - nodejs: For the worker connectivity
RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    nano \
    vim \
    python3 \
    python3-pip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 18.x
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements for Sync Agent
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Install Node requirements
COPY package.json .
RUN npm install

# Copy application code
COPY index.js .
COPY sync_agent.py .
COPY entrypoint.sh .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Environment defaults
ENV NEXUS_URL=http://localhost:3010
ENV WORKER_TOKEN=mock-token

# Default command
CMD ["./entrypoint.sh"]
