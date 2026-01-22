#!/bin/bash

# Install Claude Code on first run (if not already installed)
if [ ! -f "$HOME/.claude/bin/claude" ]; then
    echo "Installing Claude Code (first run only)..."
    curl -fsSL https://claude.ai/install.sh | bash
    echo ""
    echo "Installation complete. Starting Claude Code..."
    echo ""
fi

# Run the command passed to docker
exec "$@"
