FROM node:20-slim

# Install git and other useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code globally via npm (lighter install)
RUN npm install -g @anthropic-ai/claude-code

# Create a non-root user for security
RUN useradd -m -s /bin/bash developer
USER developer

# Set working directory (will be mounted)
WORKDIR /workspace

# Default command
CMD ["claude"]
