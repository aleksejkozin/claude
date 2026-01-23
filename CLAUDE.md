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
- **block.js**: Block creation and property functions. Blocks are plain objects with physics state (position, velocity) and properties (mass, friction, bounciness).
- **physics.js**: Gravity, collision detection/resolution, friction, damping, world constraints. Key function `applyDragFriction` handles blocks moving with dragged blocks based on friction.
- **world.js**: World state management, block CRUD, drag handling, simulation step loop. The `step()` function runs 4 collision resolution iterations for stability.

### Renderer (`src/renderer/`) - Drawing Only
- **canvas.js**: Canvas rendering functions. Takes world state, draws blocks with color coding based on properties (mass affects hue, friction/bounciness shown visually).

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

### Collision Detection and Response (Minimum Penetration Axis)

For axis-aligned boxes, we resolve on the **minimum penetration axis only**.

**Step 1: Check overlap on each axis**

```
overlapX = min(A.right - B.left, B.right - A.left)
overlapY = min(A.bottom - B.top, B.bottom - A.top)

colliding = overlapX > 0 AND overlapY > 0
```

**Step 2: Determine separation axis and direction**

```
separateOnX = overlapX < overlapY  // minimum penetration axis

dirX = sign(A.centerX - B.centerX)   // +1 if A is right of B, -1 if left
dirY = sign(A.centerY - B.centerY)   // +1 if A is below B, -1 if above
```

**Step 3: Separate on minimum penetration axis ONLY**

```
overlap = separateOnX ? overlapX : overlapY
dir = separateOnX ? dirX : dirY

if (A.isStatic) {
    // push B away on the separation axis
} else if (B.isStatic) {
    // push A away on the separation axis
} else {
    // Both dynamic: split 50/50 on separation axis
}
```

**Why minimum penetration?** When a block falls onto another:
- overlapX = 0.5 (full width, they're aligned)
- overlapY = 0.05 (just started penetrating)

We separate on Y only. If we separated on both axes, the bottom block would fly sideways!

**Step 4: Apply impulse on separation axis ONLY**

```
relV = separateOnX ? (A.vx - B.vx) : (A.vy - B.vy)
dir = separateOnX ? dirX : dirY
approaching = (relV * dir) < 0

if (approaching) {
    j = -(1 + bounciness) * relV / totalInvMass
    // apply j to the separation axis velocity only
}
```

**Step 5: Apply friction on tangent axis**

Friction opposes sliding motion perpendicular to the collision:
- Y collision (stacking) → friction affects X velocity
- X collision (side hit) → friction affects Y velocity

**Understanding the `(1 + bounciness)` factor:**

| bounciness | Factor | Result |
|------------|--------|--------|
| 0 | 1 | Blocks stop together (no bounce) |
| 0.5 | 1.5 | Partial bounce |
| 1 | 2 | Perfect bounce (velocities swap) |

**Why this conserves energy:**

The 1D collision formula is derived from:
1. Conservation of momentum: `m1*v1 + m2*v2 = constant`
2. Coefficient of restitution: `v1' - v2' = -bounciness * (v1 - v2)`

With `bounciness ≤ 1`, energy can only stay same or decrease, never increase.

### Friction

Applied tangent to collision (perpendicular to separation axis):

1. Calculate relative velocity along tangent
2. Effective friction = average of both blocks: `(A.friction + B.friction) / 2`
3. Apply friction impulse: `frictionImpulse = relVelTangent * effectiveFriction`
4. Split 50/50 between both blocks

| Friction Value | Behavior |
|----------------|----------|
| 0.0 | Frictionless (ice) |
| 0.2 | Slippery |
| 0.5 | Normal (default) |
| 1.0 | Maximum grip |

### Dragging

A dragged block is a normal physics block whose position is overridden each frame.

**Each frame while dragging:**
```
// Save old position
oldX = block.x
oldY = block.y

// Override position to follow mouse
block.x = mouseX - dragOffset.x
block.y = mouseY - dragOffset.y

// Calculate implied velocity from movement
block.vx = (block.x - oldX) / dt
block.vy = (block.y - oldY) / dt
```

**Why this works:**
- Dragged block has real velocity based on mouse movement speed
- Collision detection treats it like any other moving block
- Other blocks receive proper impulse when hit by dragged block
- On release, block keeps its velocity and moves naturally

### Mass Effects Summary

| Scenario | Heavy Block | Light Block |
|----------|-------------|-------------|
| Collision separation | Moves less | Moves more |
| Impulse velocity change | Changes less | Changes more |
| Gravity | Same acceleration | Same acceleration |
| Force applied | Same acceleration as F/m | Same acceleration as F/m |

### Constants

- `PIXELS_PER_METER = 100` — conversion factor for rendering (hides micro-errors)
- `GRAVITY = 9.8` m/s² — Earth gravity
- `DAMPING = 0.99` per frame — velocity decay (prevents energy accumulation)
- `COLLISION_ITERATIONS = 4` — solver iterations for stability
- `SLEEP_THRESHOLD = 0.001` m/s — velocities below this become zero
- `MAX_VELOCITY = 100` m/s — hard cap prevents runaway speeds

### Numerical Stability

Floating point errors can accumulate. These safeguards ensure energy never increases:

1. **Damping**: `v *= 0.99` each frame continuously drains tiny energy errors
2. **Sleep threshold**: `if |v| < 0.001 then v = 0` stops micro-jittering
3. **Velocity cap**: `if |v| > MAX then v = MAX` prevents explosions
4. **Bounciness ≤ 1**: Formula guarantees energy only decreases on collision

