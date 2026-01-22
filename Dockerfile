FROM node:20-slim

# Install git and other useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN useradd -m -s /bin/bash developer

# Switch to developer to install Claude Code in their home
USER developer
WORKDIR /home/developer

# Install Claude Code using official installer (uses Pro plan auth)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/developer/.claude/bin:${PATH}"

# Set working directory (will be mounted)
WORKDIR /workspace

# Default command
CMD ["claude"]
