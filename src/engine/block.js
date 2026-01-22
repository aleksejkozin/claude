// Block module - procedural style
// Blocks are plain objects, functions operate on them

export function createBlock(options = {}) {
  return {
    id: options.id ?? generateId(),
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 50,
    height: options.height ?? 50,
    mass: options.mass ?? 1,
    friction: options.friction ?? 0.5,
    bounciness: options.bounciness ?? 0.2,
    sticky: options.sticky ?? false,
    slippery: options.slippery ?? false,
    shape: options.shape ?? 'square', // 'square', 'brick', 'tall'

    // Physics state
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    rotation: options.rotation ?? 0,
    angularVelocity: options.angularVelocity ?? 0,

    // Interaction state
    isStatic: options.isStatic ?? false, // ground/walls don't move
    isDragging: false,
    stuckTo: [], // ids of blocks this is stuck to
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
    stuckTo: [...block.stuckTo],
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

export function applyForce(block, fx, fy) {
  // F = ma, so a = F/m
  if (block.isStatic) return;
  block.vx += fx / block.mass;
  block.vy += fy / block.mass;
}

export function getEffectiveFriction(block1, block2) {
  // If either is slippery, use lower friction
  if (block1.slippery || block2.slippery) {
    return Math.min(block1.friction, block2.friction) * 0.2;
  }
  // Average friction of both surfaces
  return (block1.friction + block2.friction) / 2;
}

export function shouldStick(block1, block2) {
  return block1.sticky || block2.sticky;
}

export function getEffectiveBounciness(block1, block2) {
  // Use average bounciness
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
  // Export only the configurable properties, not state
  return {
    width: block.width,
    height: block.height,
    mass: block.mass,
    friction: block.friction,
    bounciness: block.bounciness,
    sticky: block.sticky,
    slippery: block.slippery,
    shape: block.shape,
  };
}

export function blockFromJSON(json, x = 0, y = 0) {
  return createBlock({
    ...json,
    x,
    y,
  });
}
