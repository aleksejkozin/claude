FROM node:20-slim

# Install git and other useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd -m -s /bin/bash developer
USER developer
WORKDIR /home/developer

# Set working directory (will be mounted)
WORKDIR /workspace

# Keep container running
CMD ["bash"]
