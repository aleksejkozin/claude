# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tower Builder is a physics-based tower building game where players drag and drop blocks to build towers. Currently in dev mode with a physics engine - game mode with enemies is planned for later.

## Development

**Run the game:** Open `index.html` in a browser (no build step required).

**Run tests:** Open `test.html` in a browser. Tests run automatically and display results.

## Architecture

The codebase follows a strict separation between engine logic and rendering:

### Engine (`src/engine/`) - Pure Logic, No DOM
- **block.js**: Block creation and property functions. Blocks are plain objects with physics state (position, velocity) and properties (mass, friction, bounciness, sticky, slippery).
- **physics.js**: Gravity, collision detection/resolution, friction, damping, world constraints. Key function `applyDragFriction` handles blocks moving with dragged blocks based on friction.
- **world.js**: World state management, block CRUD, drag handling, simulation step loop. The `step()` function runs 4 collision resolution iterations for stability.

### Renderer (`src/renderer/`) - Drawing Only
- **canvas.js**: Canvas rendering functions. Takes world state, draws blocks with color coding based on properties (mass affects hue, sticky/slippery/bouncy shown as colored dots).

### Game (`src/game/`)
- **dev-mode.js**: Dev UI, input handling, game loop. Initializes world/renderer, handles mouse/touch events, connects DOM controls to engine.

### Key Patterns
- Procedural style throughout (functions operate on plain objects, no classes)
- Engine is fully testable without DOM
- Blocks use `isDragging` and `isStatic` flags to skip physics updates
- Sticky blocks force 100% friction transfer; slippery blocks reduce friction to 20%

## Testing

Tests use a simple browser-based runner in `src/tests/test-runner.js`. Import test utilities (`test`, `assertEqual`, `assertApprox`, etc.) and write test functions. Tests auto-run when `test.html` loads.
