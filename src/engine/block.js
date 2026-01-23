// Block module - procedural style
// Blocks are plain objects, functions operate on them
// All units in meters (SI)

export function createBlock(options = {}) {
  return {
    id: options.id ?? generateId(),

    // Position (meters)
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 0.5,
    height: options.height ?? 0.5,

    // Physical properties
    mass: options.mass ?? 1,           // kg
    friction: options.friction ?? 0.5, // 0-1
    bounciness: options.bounciness ?? 0.2, // 0-1

    // Velocity (m/s)
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,

    // Flags
    isStatic: options.isStatic ?? false,
    isDragging: false,
  };
}

let idCounter = 0;
function generateId() {
  return `block_${++idCounter}`;
}

export function resetIdCounter() {
  idCounter = 0;
}

export function cloneBlock(block) {
  return {
    ...block,
    id: generateId(),
  };
}

export function setPosition(block, x, y) {
  block.x = x;
  block.y = y;
}

export function setVelocity(block, vx, vy) {
  block.vx = vx;
  block.vy = vy;
}

export function getEffectiveFriction(block1, block2) {
  return (block1.friction + block2.friction) / 2;
}

export function getEffectiveBounciness(block1, block2) {
  return (block1.bounciness + block2.bounciness) / 2;
}

export function getBounds(block) {
  return {
    left: block.x,
    right: block.x + block.width,
    top: block.y,
    bottom: block.y + block.height,
  };
}

export function getCenter(block) {
  return {
    x: block.x + block.width / 2,
    y: block.y + block.height / 2,
  };
}

export function blockToJSON(block) {
  return {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    mass: block.mass,
    friction: block.friction,
    bounciness: block.bounciness,
  };
}

export function blockFromJSON(json, x, y) {
  return createBlock({
    ...json,
    x: x ?? json.x ?? 0,
    y: y ?? json.y ?? 0,
  });
}
