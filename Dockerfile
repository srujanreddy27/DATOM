FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry (for Anvil)
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# Set working directory
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
RUN pip install --no-cache-dir py-solc-x

# Copy the rest of the application
COPY backend/ ./backend/
COPY contracts/ ./contracts/
COPY scripts/ ./scripts/
COPY start.sh .

# Make start script executable
RUN chmod +x start.sh

# Expose FastAPI port
EXPOSE 8000

# Start Anvil and FastAPI
CMD ["./start.sh"]
