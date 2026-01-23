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

### Collision Detection

**Step 1: Check if boxes overlap (AABB)**

Two axis-aligned boxes collide if they overlap on both axes:
```
not colliding = A.right ≤ B.left OR A.left ≥ B.right OR A.bottom ≤ B.top OR A.top ≥ B.bottom
colliding = NOT(not colliding)
```

**Step 2: Calculate penetration depth**

How far the boxes have passed through each other:
```
overlapX = min(A.right - B.left, B.right - A.left)
overlapY = min(A.bottom - B.top, B.bottom - A.top)
penetration = min(overlapX, overlapY)
```

We use the smaller overlap because that's the shortest distance to separate them.

**Step 3: Calculate collision normal**

The direction to push blocks apart. We use center-to-center vector:
```
dx = A.centerX - B.centerX
dy = A.centerY - B.centerY
length = sqrt(dx² + dy²)
normal = { x: dx/length, y: dy/length }
```

This naturally gives near-vertical normals for stacked blocks and diagonal normals for corner hits.

**Potential issue**: Slightly offset stacked blocks get a slightly diagonal normal, which could cause drift. Friction should counteract this, but watch for instability.

### Collision Response (Impulse-Based)

**Step 1: Separate blocks**

Push blocks apart so they no longer overlap:
```
totalInverseMass = 1/m1 + 1/m2
block1.position += normal * (penetration / totalInverseMass) / m1
block2.position -= normal * (penetration / totalInverseMass) / m2
```

Lighter blocks move more. Static blocks have infinite mass (1/m = 0), so they don't move.

**Step 2: Calculate relative velocity**

How fast are they approaching each other along the collision normal?
```
relativeVelocity = (v1 - v2) · normal
```

If `relativeVelocity > 0`, they're already separating → skip impulse.

**Step 3: Calculate impulse magnitude**

The impulse formula comes from conservation of momentum:
```
j = -(1 + bounciness) * relativeVelocity / (1/m1 + 1/m2)
```

**Why this formula conserves energy (doesn't create it):**

- `bounciness = 0`: Objects stop relative to each other (perfectly inelastic). Energy is lost to "heat".
- `bounciness = 1`: Objects bounce back with same relative speed (perfectly elastic). Energy conserved.
- `bounciness` between 0-1: Some energy lost. This is realistic - real collisions lose energy.
- `bounciness > 1`: Would create energy. **We never allow this.**

The formula is derived from two constraints:
1. Momentum is conserved: `m1*v1 + m2*v2 = m1*v1' + m2*v2'`
2. Relative velocity is scaled by bounciness: `v1' - v2' = -bounciness * (v1 - v2)`

Solving these gives the impulse formula. It's mathematically impossible to create energy with `bounciness ≤ 1`.

**Step 4: Apply impulse**
```
block1.velocity += (j / m1) * normal
block2.velocity -= (j / m2) * normal
```

The same impulse `j` is applied to both blocks (Newton's third law), but divided by mass to get velocity change. Heavier blocks change velocity less.

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

