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

# Add future Claude bin to PATH
ENV PATH="/home/developer/.claude/bin:${PATH}"

# Copy entrypoint script
COPY --chown=developer:developer entrypoint.sh /home/developer/entrypoint.sh
RUN chmod +x /home/developer/entrypoint.sh

# Set working directory (will be mounted)
WORKDIR /workspace

ENTRYPOINT ["/home/developer/entrypoint.sh"]
CMD ["claude"]
