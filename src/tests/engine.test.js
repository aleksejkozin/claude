// Engine tests

import {
  test,
  assertEqual,
  assertApprox,
  assertTrue,
  assertFalse,
  assertNotNull,
  assertNull,
} from './test-runner.js';

import {
  createBlock,
  resetIdCounter,
  setPosition,
  setVelocity,
  getEffectiveFriction,
  getEffectiveBounciness,
  getBounds,
  getCenter,
  blockToJSON,
  blockFromJSON,
} from '../engine/block.js';

import {
  applyGravity,
  updatePosition,
  checkCollision,
  resolveCollision,
  applyDamping,
  constrainToWorld,
  GRAVITY,
} from '../engine/physics.js';

import {
  createWorld,
  addBlock,
  removeBlock,
  getBlockById,
  getBlockAt,
  selectBlock,
  startDrag,
  updateDrag,
  endDrag,
  step,
  clearBlocks,
} from '../engine/world.js';

// ============ Block Tests ============

test('createBlock creates block with default values', () => {
  resetIdCounter();
  const block = createBlock();
  assertNotNull(block.id);
  assertEqual(block.x, 0);
  assertEqual(block.y, 0);
  assertApprox(block.width, 0.5, 0.01);
  assertApprox(block.height, 0.5, 0.01);
  assertEqual(block.mass, 1);
  assertApprox(block.friction, 0.5, 0.01);
  assertApprox(block.bounciness, 0.2, 0.01);
});

test('createBlock accepts custom options', () => {
  const block = createBlock({
    x: 1,
    y: 2,
    width: 0.8,
    height: 0.4,
    mass: 2.5,
    friction: 0.7,
  });
  assertEqual(block.x, 1);
  assertEqual(block.y, 2);
  assertApprox(block.width, 0.8, 0.01);
  assertApprox(block.height, 0.4, 0.01);
  assertEqual(block.mass, 2.5);
  assertApprox(block.friction, 0.7, 0.01);
});

test('setPosition updates block position', () => {
  const block = createBlock();
  setPosition(block, 0.5, 0.75);
  assertApprox(block.x, 0.5, 0.01);
  assertApprox(block.y, 0.75, 0.01);
});

test('setVelocity updates block velocity', () => {
  const block = createBlock();
  setVelocity(block, 10, -5);
  assertEqual(block.vx, 10);
  assertEqual(block.vy, -5);
});

test('getEffectiveFriction averages friction values', () => {
  const block1 = createBlock({ friction: 0.4 });
  const block2 = createBlock({ friction: 0.6 });
  assertApprox(getEffectiveFriction(block1, block2), 0.5, 0.01);
});

test('getEffectiveBounciness averages bounciness values', () => {
  const block1 = createBlock({ bounciness: 0.2 });
  const block2 = createBlock({ bounciness: 0.8 });
  assertApprox(getEffectiveBounciness(block1, block2), 0.5, 0.01);
});

test('getBounds returns correct boundaries', () => {
  const block = createBlock({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  const bounds = getBounds(block);
  assertApprox(bounds.left, 0.1, 0.01);
  assertApprox(bounds.right, 0.4, 0.01);
  assertApprox(bounds.top, 0.2, 0.01);
  assertApprox(bounds.bottom, 0.6, 0.01);
});

test('getCenter returns center point', () => {
  const block = createBlock({ x: 0, y: 0, width: 1, height: 0.5 });
  const center = getCenter(block);
  assertApprox(center.x, 0.5, 0.01);
  assertApprox(center.y, 0.25, 0.01);
});

test('blockToJSON exports configurable properties', () => {
  const block = createBlock({ x: 1, y: 2, width: 0.6, mass: 3 });
  const json = blockToJSON(block);
  assertApprox(json.width, 0.6, 0.01);
  assertEqual(json.mass, 3);
  assertEqual(json.x, 1);
  assertEqual(json.y, 2);
});

test('blockFromJSON creates block from JSON', () => {
  const json = { width: 0.8, height: 0.3, mass: 2 };
  const block = blockFromJSON(json, 1, 2);
  assertApprox(block.width, 0.8, 0.01);
  assertApprox(block.height, 0.3, 0.01);
  assertEqual(block.mass, 2);
  assertEqual(block.x, 1);
  assertEqual(block.y, 2);
});

// ============ Physics Tests ============

test('applyGravity increases downward velocity', () => {
  const block = createBlock();
  applyGravity(block, 0.1);
  assertApprox(block.vy, GRAVITY * 0.1, 0.01);
});

test('applyGravity does nothing to static blocks', () => {
  const block = createBlock({ isStatic: true });
  applyGravity(block, 0.1);
  assertEqual(block.vy, 0);
});

test('applyGravity does nothing to dragging blocks', () => {
  const block = createBlock();
  block.isDragging = true;
  applyGravity(block, 0.1);
  assertEqual(block.vy, 0);
});

test('updatePosition moves block by velocity', () => {
  const block = createBlock({ vx: 1, vy: 0.5 });
  updatePosition(block, 0.1);
  assertApprox(block.x, 0.1, 0.01);
  assertApprox(block.y, 0.05, 0.01);
});

test('checkCollision returns null for non-overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  assertNull(checkCollision(block1, block2));
});

test('checkCollision detects overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertTrue(collision.overlapX > 0);
  assertTrue(collision.overlapY > 0);
});

test('checkCollision returns correct direction for horizontal collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.45, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.dirX, -1); // block1 is left of block2
});

test('checkCollision returns correct direction for vertical collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0, y: 0.45, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.dirY, -1); // block1 is above block2
});

test('applyDamping reduces velocity', () => {
  const block = createBlock({ vx: 1, vy: 1 });
  applyDamping(block);
  assertTrue(block.vx < 1);
  assertTrue(block.vy < 1);
});

test('applyDamping applies sleep threshold', () => {
  const block = createBlock({ vx: 0.0001, vy: 0.0001 });
  applyDamping(block);
  assertEqual(block.vx, 0);
  assertEqual(block.vy, 0);
});

test('constrainToWorld keeps block inside bounds', () => {
  const block = createBlock({ x: -0.1, y: 0, width: 0.5, height: 0.5 });
  constrainToWorld(block, 4, 6);
  assertEqual(block.x, 0);
});

test('constrainToWorld bounces block off floor', () => {
  const block = createBlock({ x: 0, y: 5.8, width: 0.5, height: 0.5, vy: 1, bounciness: 0.5 });
  constrainToWorld(block, 4, 6);
  assertApprox(block.y, 5.5, 0.01); // 6 - 0.5
  assertTrue(block.vy < 0); // Should be bouncing up
});

// ============ World Tests ============

test('createWorld initializes empty world', () => {
  const world = createWorld(4, 6);
  assertEqual(world.width, 4);
  assertEqual(world.height, 6);
  assertEqual(world.blocks.length, 0);
  assertNull(world.selectedBlockId);
});

test('addBlock adds block to world', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  assertEqual(world.blocks.length, 1);
  assertEqual(world.blocks[0], block);
});

test('removeBlock removes block from world', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  removeBlock(world, block.id);
  assertEqual(world.blocks.length, 0);
});

test('getBlockById finds block by id', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  const found = getBlockById(world, block.id);
  assertEqual(found, block);
});

test('getBlockAt finds block at coordinates', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  const found = getBlockAt(world, 1.25, 1.25);
  assertEqual(found, block);
});

test('getBlockAt returns null for empty space', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  const found = getBlockAt(world, 2, 2);
  assertNull(found);
});

test('selectBlock sets selected block id', () => {
  const world = createWorld(4, 6);
  const block = createBlock();
  addBlock(world, block);
  selectBlock(world, block.id);
  assertEqual(world.selectedBlockId, block.id);
});

test('startDrag begins dragging block', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1 });
  addBlock(world, block);
  startDrag(world, block.id, 1.1, 1.1);
  assertEqual(world.draggedBlockId, block.id);
  assertTrue(block.isDragging);
});

test('updateDrag moves dragged block', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  startDrag(world, block.id, 1.25, 1.25);
  updateDrag(world, 2, 2, 0.016);
  assertApprox(block.x, 1.75, 0.01); // 2 - offset(0.25)
  assertApprox(block.y, 1.75, 0.01);
});

test('updateDrag calculates velocity from movement', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, width: 0.5, height: 0.5 });
  addBlock(world, block);
  startDrag(world, block.id, 1.25, 1.25);
  updateDrag(world, 2.25, 1.25, 0.1); // move 1m right in 0.1s
  assertApprox(block.vx, 10, 0.1); // 1m / 0.1s = 10 m/s
});

test('endDrag stops dragging', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1 });
  addBlock(world, block);
  startDrag(world, block.id, 1.1, 1.1);
  endDrag(world);
  assertNull(world.draggedBlockId);
  assertFalse(block.isDragging);
});

test('clearBlocks removes all blocks', () => {
  const world = createWorld(4, 6);
  addBlock(world, createBlock());
  addBlock(world, createBlock());
  clearBlocks(world);
  assertEqual(world.blocks.length, 0);
});

test('step updates physics for all blocks', () => {
  const world = createWorld(4, 6);
  const block = createBlock({ x: 1, y: 1, vx: 1 });
  addBlock(world, block);
  step(world, 0.1);
  assertTrue(block.x > 1); // Moved by velocity
  assertTrue(block.vy > 0); // Affected by gravity
});

test('step does nothing when paused', () => {
  const world = createWorld(4, 6);
  world.paused = true;
  const block = createBlock({ x: 1, y: 1, vx: 1 });
  addBlock(world, block);
  step(world, 0.1);
  assertEqual(block.x, 1);
  assertEqual(block.vy, 0);
});

// ============ Collision Resolution Tests ============

test('resolveCollision separates overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(block1, block2);
  resolveCollision(block1, block2, collision);
  // After resolution, blocks should no longer overlap
  const newCollision = checkCollision(block1, block2);
  assertNull(newCollision);
});

test('resolveCollision applies impulse for approaching blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5, vx: 5 });
  const block2 = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5, vx: 0 });
  const collision = checkCollision(block1, block2);
  resolveCollision(block1, block2, collision);
  // block1 should slow down, block2 should speed up
  assertTrue(block1.vx < 5);
  assertTrue(block2.vx > 0);
});

test('resolveCollision respects static blocks', () => {
  const staticBlock = createBlock({ x: 0, y: 0, width: 0.5, height: 0.5, isStatic: true });
  const dynamicBlock = createBlock({ x: 0.4, y: 0, width: 0.5, height: 0.5 });
  const collision = checkCollision(staticBlock, dynamicBlock);
  resolveCollision(staticBlock, dynamicBlock, collision);
  // Static block should not move
  assertEqual(staticBlock.x, 0);
  assertEqual(staticBlock.y, 0);
  // Dynamic block should be pushed away
  assertTrue(dynamicBlock.x > 0.4);
});

// ============ Falling Block Test (Bug Reproduction) ============

test('block falling onto another should bounce and rest, not push sideways', () => {
  // Bottom block sitting on ground
  const bottom = createBlock({
    x: 1, y: 3, // position
    width: 0.5, height: 0.5,
    vx: 0, vy: 0 // stationary
  });

  // Top block falling down onto bottom block
  // Slightly overlapping vertically (just landed)
  const top = createBlock({
    x: 1, y: 2.45, // overlaps by 0.05m vertically
    width: 0.5, height: 0.5,
    vx: 0, vy: 2 // falling at 2 m/s
  });

  const collision = checkCollision(top, bottom);
  assertNotNull(collision, 'Should detect collision');

  // Key assertion: X overlap is large (0.5), Y overlap is small (0.05)
  // So separation should happen on Y axis only
  assertApprox(collision.overlapX, 0.5, 0.01);
  assertApprox(collision.overlapY, 0.05, 0.01);

  const originalBottomX = bottom.x;
  const originalTopX = top.x;

  resolveCollision(top, bottom, collision);

  // CRITICAL: Neither block should move horizontally!
  // This is the bug - bottom block is being pushed sideways
  assertApprox(bottom.x, originalBottomX, 0.01, 'Bottom block should NOT move horizontally');
  assertApprox(top.x, originalTopX, 0.01, 'Top block should NOT move horizontally');

  // Top block should bounce up (negative vy)
  assertTrue(top.vy < 0, 'Top block should bounce up');

  // Bottom block might get small downward impulse but should stay mostly still
  assertTrue(Math.abs(bottom.vy) < 1, 'Bottom block should not get large velocity');
});

test('friction transfers velocity from dragging block to resting block', () => {
  // Bottom block being dragged with velocity
  const bottom = createBlock({
    x: 1, y: 3,
    width: 0.5, height: 0.5,
    friction: 1.0,
    vx: 5, vy: 0 // moving right at 5 m/s
  });
  bottom.isDragging = true;

  // Top block resting on bottom, stationary
  const top = createBlock({
    x: 1, y: 2.45, // slight overlap
    width: 0.5, height: 0.5,
    friction: 1.0,
    vx: 0, vy: 0
  });

  const collision = checkCollision(top, bottom);
  assertNotNull(collision, 'Should detect collision');

  resolveCollision(top, bottom, collision);

  // With friction=1, top block should match bottom's velocity
  assertApprox(top.vx, 5, 0.1, 'Top block should move with dragged block');
});

// ============ Multi-Frame Drag Friction Test ============

test('stacked block should follow dragged block with friction=1 over multiple frames', () => {
  const world = createWorld(10, 10);

  // Bottom block that will be dragged
  const bottom = createBlock({
    x: 2, y: 3,
    width: 0.5, height: 0.5,
    friction: 1.0,
    bounciness: 0,
  });
  addBlock(world, bottom);

  // Top block resting on bottom (touching, not overlapping)
  const top = createBlock({
    x: 2, y: 2.5, // exactly on top
    width: 0.5, height: 0.5,
    friction: 1.0,
    bounciness: 0,
  });
  addBlock(world, top);

  // Let them settle first
  for (let i = 0; i < 10; i++) {
    step(world, 0.016);
  }

  // Start dragging bottom block
  const centerX = bottom.x + bottom.width / 2;
  const centerY = bottom.y + bottom.height / 2;
  startDrag(world, bottom.id, centerX, centerY);

  const dt = 0.016; // ~60fps
  const dragSpeed = 0.02; // 0.02 m per frame = ~1.25 m/s drag speed

  // Simulate imprecise human dragging - slight vertical wobble
  const frames = 30;
  for (let i = 0; i < frames; i++) {
    // Imprecise drag: mostly right, but with slight Y wobble
    const wobbleY = Math.sin(i * 0.5) * 0.002; // tiny vertical wobble
    const newMouseX = centerX + (i + 1) * dragSpeed + world.dragOffset.x;
    const newMouseY = centerY + wobbleY + world.dragOffset.y;

    updateDrag(world, newMouseX, newMouseY, dt);
    step(world, dt);
  }

  // After 30 frames of dragging, bottom moved ~0.6m right
  const bottomMovement = bottom.x - 2;
  const topMovement = top.x - 2;

  // With friction=1, top block should have moved the same distance as bottom
  // Allow small tolerance for numerical errors
  const slippage = Math.abs(bottomMovement - topMovement);

  assertTrue(
    slippage < 0.05,
    `Top block slipped ${slippage.toFixed(3)}m behind bottom block. ` +
    `Bottom moved ${bottomMovement.toFixed(3)}m, top moved ${topMovement.toFixed(3)}m. ` +
    `With friction=1, slippage should be < 0.05m`
  );
});

console.log('\n=== All tests complete ===');
