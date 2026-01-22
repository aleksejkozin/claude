# Tower Builder - Design Document

## Overview
Physics-based tower building game. Single vertical screen. Player drags and drops blocks to build the tallest tower possible while enemies try to knock it down.

## Screen Layout
- Vertical orientation (taller than wide)
- Ground/platform at bottom
- Blocks spawn or are created by player
- Height indicator on side

## Core Mechanics

### Physics Engine
- Gravity affects all blocks
- Collision detection between blocks
- Blocks can stack, slide, topple

### Block Properties
| Property | Type | Description |
|----------|------|-------------|
| mass | number | Weight, affects how easily pushed |
| friction | number | Surface friction between blocks |
| bounciness | number | How much it bounces on collision |
| sticky | boolean | Sticks to other blocks, requires force to separate |
| slippery | boolean | Very low friction, slides easily |
| shape | enum | square, brick (wide), tall, etc. |
| width | number | Block width |
| height | number | Block height |

### Player Interaction
- Drag blocks with mouse/touch
- Drop blocks to place them
- Can grab and move already-placed blocks
- Pull blocks out of tower (risky but strategic)

### Enemies
- Fly in from left/right sides
- Push against blocks on contact
- Player must manipulate tower to let them pass safely
- Example: pull out middle block to create gap for enemy to fly through

## Game Modes

### Dev Mode (Build First)
- Create blocks with any properties
- Delete blocks
- Configure all properties via number inputs and checkboxes (no sliders)
- Export current block set to JSON
- Import block sets from JSON
- Test physics and interactions

### Game Mode (Later)
- Predefined block sets loaded from JSON
- Waves of enemies
- Score based on tower height over time
- Increasing difficulty

## Architecture

```
src/
  engine/           # Pure logic, no rendering
    physics.js      # Gravity, collision, forces
    block.js        # Block class and properties
    world.js        # World state, block management
    enemy.js        # Enemy behavior
  renderer/         # Drawing only
    canvas.js       # Canvas rendering
    sprites.js      # Visual representations
  game/
    dev-mode.js     # Dev mode UI and controls
    game-mode.js    # Actual gameplay
  tests/
    physics.test.js
    block.test.js
    world.test.js
```

### Engine (Testable, No DOM)
- Pure functions and classes
- No canvas/DOM dependencies
- All game logic here
- Fully unit testable

### Renderer (Separate)
- Takes world state
- Draws to canvas
- No game logic

## Testing
- Unit tests for physics calculations
- Tests for each block property behavior
- Tests for collision detection
- Tests for enemy interactions
- Run with simple test runner (no build step, works in browser)

## Tech Stack
- Vanilla JS (no frameworks)
- HTML5 Canvas for rendering
- JSON for block set storage
- Simple in-browser test runner
- GitHub Pages hosting

## Dev Mode UI
```
+------------------+------------------+
|                  |  Block Creator   |
|                  |  ──────────────  |
|                  |  Width: [___]    |
|    Game Canvas   |  Height: [___]   |
|                  |  Mass: [___]     |
|                  |  Friction: [___] |
|                  |  Bounce: [___]   |
|                  |  [x] Sticky      |
|                  |  [ ] Slippery    |
|                  |  Shape: [select] |
|                  |                  |
|                  |  [Create Block]  |
|                  |  [Delete Selected]|
|                  |                  |
|                  |  [Export JSON]   |
|                  |  [Import JSON]   |
+------------------+------------------+
```

## First Milestone
1. Engine with physics and blocks
2. Canvas renderer
3. Dev mode with block creator
4. Basic tests
5. No enemies yet
