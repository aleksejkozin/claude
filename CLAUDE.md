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

**Units: Metric System (SI)**

The physics engine uses real-world units internally. Only the renderer converts to pixels.

| Quantity | Unit | Example |
|----------|------|---------|
| Position | meters | x = 2.5 m |
| Velocity | m/s | vx = 1.2 m/s |
| Mass | kg | mass = 2 kg |
| Gravity | m/s² | 9.8 m/s² |
| Size | meters | width = 0.5 m |

**Conversion constant:** `PIXELS_PER_METER = 100` (1 meter = 100 pixels on screen)

**Renderer converts to pixels:**
```
screenX = block.x * PIXELS_PER_METER
screenY = block.y * PIXELS_PER_METER
```

**Input converts to meters:**
```
worldX = mouseX / PIXELS_PER_METER
worldY = mouseY / PIXELS_PER_METER
```

### Block Data Shape
```javascript
{
  // Identity
  id: string,              // e.g. "block_1", auto-generated

  // Geometry (meters)
  x: number,               // left edge position (m)
  y: number,               // top edge position (m)
  width: number,           // default 0.5 m
  height: number,          // default 0.5 m

  // Physical Properties
  mass: number,            // kg, default 1
  friction: number,        // 0-1, default 0.5, affects sliding
  bounciness: number,      // 0-1, default 0.2, coefficient of restitution

  // Velocity State (m/s)
  vx: number,              // horizontal velocity (m/s)
  vy: number,              // vertical velocity (m/s)

  // Flags
  isStatic: boolean,       // if true, block never moves (ground/walls)
  isDragging: boolean,     // if true, block follows mouse, ignores physics
}
```

### World Data Shape
```javascript
{
  width: number,           // world width (m)
  height: number,          // world height (m)
  blocks: Block[],         // all blocks in simulation
  blockTemplates: object[],// saved block configurations for spawning
  selectedBlockId: string | null,
  draggedBlockId: string | null,
  dragOffset: { x, y },    // mouse offset from block origin during drag (m)
  lastDragTime: number,    // for calculating drag velocity
  paused: boolean,
}
```

### Physics Loop (world.step)

Each frame, with timestep `dt` (seconds):

1. **Apply Gravity**: Each non-static, non-dragging block gets `vy += 9.8 * dt`
2. **Update Positions**: `x += vx * dt`, `y += vy * dt`
3. **Collision Resolution** (4 iterations for stability):
   - Check every pair of blocks for AABB overlap
   - If colliding, separate and apply impulse
4. **World Constraints**: Bounce off walls/floor
5. **Apply Damping**: Multiply velocities by 0.99

### Collision Detection and Response (Independent Axes)

For axis-aligned boxes, we handle X and Y axes independently. No normals, no projection math.

**Step 1: Check overlap on each axis**

```
overlapX = min(A.right - B.left, B.right - A.left)
overlapY = min(A.bottom - B.top, B.bottom - A.top)

colliding = overlapX > 0 AND overlapY > 0
```

**Step 2: Determine push direction**

```
dirX = sign(A.centerX - B.centerX)   // +1 if A is right of B, -1 if left
dirY = sign(A.centerY - B.centerY)   // +1 if A is below B, -1 if above
```

**Step 3: Separate on each axis**

Push blocks apart proportional to inverse mass:

```
totalInvMass = 1/m1 + 1/m2

A.x += dirX * overlapX * (1/m1) / totalInvMass
B.x -= dirX * overlapX * (1/m2) / totalInvMass

A.y += dirY * overlapY * (1/m1) / totalInvMass
B.y -= dirY * overlapY * (1/m2) / totalInvMass
```

Static blocks have `1/m = 0`, so they don't move.

**Step 4: Apply impulse on each axis (1D collision formula)**

For X axis:
```
relVx = A.vx - B.vx
approaching = (relVx * dirX) < 0    // moving toward each other?

if (approaching) {
    jx = -(1 + bounciness) * relVx / totalInvMass
    A.vx += jx / m1
    B.vx -= jx / m2
}
```

Same formula for Y axis with `vy`.

**Why independent axes work:**

- Simpler: no normal vectors, no dot products
- Stable stacking: vertical collision always gets pure vertical impulse
- Corner collisions: both axes get impulses (correct for rectangles)

**Why this conserves energy:**

Each axis uses the standard 1D collision formula derived from:
1. Conservation of momentum: `m1*v1 + m2*v2 = constant`
2. Coefficient of restitution: `v1' - v2' = -bounciness * (v1 - v2)`

With `bounciness ≤ 1`, energy can only stay same or decrease, never increase.

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

- `PIXELS_PER_METER = 100` — conversion factor for rendering
- `GRAVITY = 9.8` m/s² — Earth gravity
- `DAMPING = 0.99` per frame — velocity decay
- `COLLISION_ITERATIONS = 4` — solver iterations for stability
- `SEPARATION_SLOP = 0.0001` m (0.01 mm) — prevents jitter

