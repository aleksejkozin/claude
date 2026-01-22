#!/bin/bash

# Claude Code Docker Runner
# Usage: ./run-claude.sh [any claude arguments]

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Warning: ANTHROPIC_API_KEY not set"
    echo "Set it with: export ANTHROPIC_API_KEY=your-key"
    echo ""
fi

# Build if image doesn't exist
if ! docker image inspect claude-code:local &> /dev/null; then
    echo "Building Claude Code Docker image..."
    docker compose build
fi

# Run Claude Code
docker compose run --rm claude-code claude "$@"
