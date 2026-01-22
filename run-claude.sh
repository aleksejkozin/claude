#!/bin/bash

# Claude Code Docker Runner (uses Pro plan auth)
# Usage: ./run-claude.sh [any claude arguments]

# Build if image doesn't exist
if ! docker image inspect claude-code:local &> /dev/null; then
    echo "Building Claude Code Docker image..."
    docker compose build
fi

# Run Claude Code
# First run will prompt for login via browser
docker compose run --rm claude-code claude "$@"
