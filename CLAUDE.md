# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- Every time you make changes push them to main, I will check them on a different machine
- This document is supposed to be human read. Engineer should understand and validate this document
- All design decisions should be documented here. No code should exist if it is not liked to this document. If such code exests it should be removed or this document should be updated to include
- Basically, this is the main source of truth, the code is secondary
- Here we also describe the data types/object shapes. We do not use types script but I would like to see data descriptions and validate them
- The project should not contain unused code, files, or descriptions

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
- We host game on github pages
- Procedural style throughout (functions operate on plain objects, no classes)
- Engine is fully testable without DOM

---

## Physics Engine Specification

- The drag system should be impulse controlled. Like, dragged mouse should prove physical impulse and not just glue a box to the cursor
- Let's use metric system. 9.8 for gravity, meters for sizes, kg for mass etc

### Block Data Shape
```javascript
{
  // Identity
  id: string,              // e.g. "block_1", auto-generated

  // Geometry
  x: number,               // left edge position (pixels)
  y: number,               // top edge position (pixels)
  width: number,           // default 50
  height: number,          // default 50

  // Physical Properties
  mass: number,            // default 1, affects impulse distribution
  friction: number,        // 0-1, default 0.5, affects sliding
  bounciness: number,      // 0-1, default 0.2, coefficient of restitution

  // Velocity State
  vx: number,              // horizontal velocity (pixels/second)
  vy: number,              // vertical velocity (pixels/second)

  // Flags
  isStatic: boolean,       // if true, block never moves (ground/walls)
  isDragging: boolean,     // if true, block follows mouse, ignores physics
}
```

### World Data Shape
```javascript
{
  width: number,           // world width in pixels
  height: number,          // world height in pixels
  blocks: Block[],         // all blocks in simulation
  blockTemplates: object[],// saved block configurations for spawning
  selectedBlockId: string | null,
  draggedBlockId: string | null,
  dragOffset: { x, y },    // mouse offset from block origin during drag
  lastDragTime: number,    // for calculating drag velocity
  paused: boolean,
}
```

### Physics Loop (world.step)

Each frame, with timestep `dt` (seconds):

1. **Apply Gravity**: Each non-static, non-dragging block gets `vy += 980 * dt`
2. **Update Positions**: `x += vx * dt`, `y += vy * dt`
3. **Collision Resolution** (4 iterations for stability):
   - Check every pair of blocks for AABB overlap
   - If colliding, separate and apply impulse
4. **World Constraints**: Bounce off walls/floor
5. **Apply Damping**: Multiply velocities by 0.99

### Collision Detection (AABB)

Two boxes collide if their bounding boxes overlap:
- Calculate overlap on each axis
- Collision normal points along axis of minimum penetration
- Return `{ normal: {x, y}, penetration: number }`

### Collision Response (Impulse-Based)

When blocks collide:

1. **Separation**: Push blocks apart along collision normal, proportional to inverse mass
   - Lighter blocks move more, heavier blocks move less
   - Formula: `correction = penetration / (1/m1 + 1/m2)`
   - Each block moves: `correction / its_mass`

2. **Impulse Calculation**:
   - Relative velocity along normal: `relVel = (v1 - v2) · normal`
   - If separating (relVel > 0), skip impulse
   - Impulse magnitude: `j = -(1 + bounciness) * relVel / (1/m1 + 1/m2)`

3. **Apply Impulse**:
   - `block1.v += j * normal / block1.mass`
   - `block2.v -= j * normal / block2.mass`
   - Heavier blocks change velocity less

### Friction

Applied tangent to collision (perpendicular to normal):

1. Calculate relative velocity along tangent
2. Effective friction = average of both blocks (or 20% if either is slippery)
3. Apply friction impulse: `frictionImpulse = relVelTangent * friction`
4. Split 50/50 between both blocks

### Drag Friction (blocks moving with dragged block)

When you drag a block, blocks resting on top should move with it:

1. Find all blocks whose bottom touches dragged block's top
2. Move each by `dx * moveFactor` where:
   - `moveFactor = 1.0` if either block is sticky
   - `moveFactor = friction` otherwise
3. Set velocity for inertia when drag ends: `vx = effectiveDx / dt`
4. Recursively apply to blocks stacked higher

### Mass Effects Summary

| Scenario | Heavy Block | Light Block |
|----------|-------------|-------------|
| Collision separation | Moves less | Moves more |
| Impulse velocity change | Changes less | Changes more |
| Gravity | Same acceleration | Same acceleration |
| Force applied | Same acceleration as F/m | Same acceleration as F/m |

### Constants

- `GRAVITY = 980` pixels/second² (roughly 1g if 100px = 1m)
- `DAMPING = 0.99` per frame
- `COLLISION_ITERATIONS = 4`
- `SEPARATION_SLOP = 0.01` pixels (prevents jitter)

