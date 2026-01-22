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
  applyForce,
  getEffectiveFriction,
  shouldStick,
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
  isRestingOn,
  getBlocksRestingOn,
  applyDragFriction,
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
  getTowerHeight,
  clearBlocks,
} from '../engine/world.js';

// ============ Block Tests ============

test('createBlock creates block with default values', () => {
  resetIdCounter();
  const block = createBlock();
  assertNotNull(block.id);
  assertEqual(block.x, 0);
  assertEqual(block.y, 0);
  assertEqual(block.width, 50);
  assertEqual(block.height, 50);
  assertEqual(block.mass, 1);
  assertFalse(block.sticky);
  assertFalse(block.slippery);
});

test('createBlock accepts custom options', () => {
  const block = createBlock({
    x: 100,
    y: 200,
    width: 80,
    height: 40,
    mass: 2.5,
    sticky: true,
  });
  assertEqual(block.x, 100);
  assertEqual(block.y, 200);
  assertEqual(block.width, 80);
  assertEqual(block.height, 40);
  assertEqual(block.mass, 2.5);
  assertTrue(block.sticky);
});

test('setPosition updates block position', () => {
  const block = createBlock();
  setPosition(block, 50, 75);
  assertEqual(block.x, 50);
  assertEqual(block.y, 75);
});

test('setVelocity updates block velocity', () => {
  const block = createBlock();
  setVelocity(block, 10, -5);
  assertEqual(block.vx, 10);
  assertEqual(block.vy, -5);
});

test('applyForce changes velocity based on mass', () => {
  const block = createBlock({ mass: 2 });
  applyForce(block, 10, 20);
  assertEqual(block.vx, 5); // F/m = 10/2
  assertEqual(block.vy, 10); // F/m = 20/2
});

test('applyForce does nothing to static blocks', () => {
  const block = createBlock({ isStatic: true });
  applyForce(block, 100, 100);
  assertEqual(block.vx, 0);
  assertEqual(block.vy, 0);
});

test('getEffectiveFriction averages friction values', () => {
  const block1 = createBlock({ friction: 0.4 });
  const block2 = createBlock({ friction: 0.6 });
  assertApprox(getEffectiveFriction(block1, block2), 0.5);
});

test('getEffectiveFriction reduces for slippery blocks', () => {
  const block1 = createBlock({ friction: 0.5, slippery: true });
  const block2 = createBlock({ friction: 0.5 });
  assertTrue(getEffectiveFriction(block1, block2) < 0.2);
});

test('shouldStick returns true if either block is sticky', () => {
  const sticky = createBlock({ sticky: true });
  const normal = createBlock({ sticky: false });
  assertTrue(shouldStick(sticky, normal));
  assertTrue(shouldStick(normal, sticky));
  assertFalse(shouldStick(normal, normal));
});

test('getEffectiveBounciness averages bounciness values', () => {
  const block1 = createBlock({ bounciness: 0.2 });
  const block2 = createBlock({ bounciness: 0.8 });
  assertApprox(getEffectiveBounciness(block1, block2), 0.5);
});

test('getBounds returns correct boundaries', () => {
  const block = createBlock({ x: 10, y: 20, width: 30, height: 40 });
  const bounds = getBounds(block);
  assertEqual(bounds.left, 10);
  assertEqual(bounds.right, 40);
  assertEqual(bounds.top, 20);
  assertEqual(bounds.bottom, 60);
});

test('getCenter returns center point', () => {
  const block = createBlock({ x: 0, y: 0, width: 100, height: 50 });
  const center = getCenter(block);
  assertEqual(center.x, 50);
  assertEqual(center.y, 25);
});

test('blockToJSON exports configurable properties', () => {
  const block = createBlock({ width: 60, mass: 3, sticky: true });
  const json = blockToJSON(block);
  assertEqual(json.width, 60);
  assertEqual(json.mass, 3);
  assertTrue(json.sticky);
  assertEqual(json.x, undefined); // Position not exported
});

test('blockFromJSON creates block from JSON', () => {
  const json = { width: 80, height: 30, mass: 2, sticky: true };
  const block = blockFromJSON(json, 100, 200);
  assertEqual(block.width, 80);
  assertEqual(block.height, 30);
  assertEqual(block.mass, 2);
  assertTrue(block.sticky);
  assertEqual(block.x, 100);
  assertEqual(block.y, 200);
});

// ============ Physics Tests ============

test('applyGravity increases downward velocity', () => {
  const block = createBlock();
  applyGravity(block, 0.1);
  assertApprox(block.vy, GRAVITY * 0.1, 1);
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
  const block = createBlock({ vx: 100, vy: 50 });
  updatePosition(block, 0.1);
  assertApprox(block.x, 10, 0.1);
  assertApprox(block.y, 5, 0.1);
});

test('checkCollision returns null for non-overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 50, height: 50 });
  const block2 = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  assertNull(checkCollision(block1, block2));
});

test('checkCollision detects overlapping blocks', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 50, height: 50 });
  const block2 = createBlock({ x: 40, y: 0, width: 50, height: 50 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertNotNull(collision.normal);
  assertTrue(collision.penetration > 0);
});

test('checkCollision returns correct normal for horizontal collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 50, height: 50 });
  const block2 = createBlock({ x: 45, y: 0, width: 50, height: 50 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.normal.x, -1); // block1 should move left
  assertEqual(collision.normal.y, 0);
});

test('checkCollision returns correct normal for vertical collision', () => {
  const block1 = createBlock({ x: 0, y: 0, width: 50, height: 50 });
  const block2 = createBlock({ x: 0, y: 45, width: 50, height: 50 });
  const collision = checkCollision(block1, block2);
  assertNotNull(collision);
  assertEqual(collision.normal.x, 0);
  assertEqual(collision.normal.y, -1); // block1 should move up
});

test('applyDamping reduces velocity', () => {
  const block = createBlock({ vx: 100, vy: 100 });
  applyDamping(block, 0.9);
  assertApprox(block.vx, 90, 0.1);
  assertApprox(block.vy, 90, 0.1);
});

test('constrainToWorld keeps block inside bounds', () => {
  const block = createBlock({ x: -10, y: 0, width: 50, height: 50 });
  constrainToWorld(block, 400, 600);
  assertEqual(block.x, 0);
});

test('constrainToWorld bounces block off floor', () => {
  const block = createBlock({ x: 0, y: 580, width: 50, height: 50, vy: 100, bounciness: 0.5 });
  constrainToWorld(block, 400, 600);
  assertEqual(block.y, 550); // 600 - 50
  assertTrue(block.vy < 0); // Should be bouncing up
});

// ============ World Tests ============

test('createWorld initializes empty world', () => {
  const world = createWorld(400, 600);
  assertEqual(world.width, 400);
  assertEqual(world.height, 600);
  assertEqual(world.blocks.length, 0);
  assertNull(world.selectedBlockId);
});

test('addBlock adds block to world', () => {
  const world = createWorld(400, 600);
  const block = createBlock();
  addBlock(world, block);
  assertEqual(world.blocks.length, 1);
  assertEqual(world.blocks[0], block);
});

test('removeBlock removes block from world', () => {
  const world = createWorld(400, 600);
  const block = createBlock();
  addBlock(world, block);
  removeBlock(world, block.id);
  assertEqual(world.blocks.length, 0);
});

test('getBlockById finds block by id', () => {
  const world = createWorld(400, 600);
  const block = createBlock();
  addBlock(world, block);
  const found = getBlockById(world, block.id);
  assertEqual(found, block);
});

test('getBlockAt finds block at coordinates', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  addBlock(world, block);
  const found = getBlockAt(world, 125, 125);
  assertEqual(found, block);
});

test('getBlockAt returns null for empty space', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  addBlock(world, block);
  const found = getBlockAt(world, 200, 200);
  assertNull(found);
});

test('selectBlock sets selected block id', () => {
  const world = createWorld(400, 600);
  const block = createBlock();
  addBlock(world, block);
  selectBlock(world, block.id);
  assertEqual(world.selectedBlockId, block.id);
});

test('startDrag begins dragging block', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100 });
  addBlock(world, block);
  startDrag(world, block.id, 110, 110);
  assertEqual(world.draggedBlockId, block.id);
  assertTrue(block.isDragging);
});

test('updateDrag moves dragged block', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  addBlock(world, block);
  startDrag(world, block.id, 125, 125);
  updateDrag(world, 200, 200);
  assertEqual(block.x, 175); // 200 - offset(25)
  assertEqual(block.y, 175);
});

test('endDrag stops dragging', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100 });
  addBlock(world, block);
  startDrag(world, block.id, 110, 110);
  endDrag(world);
  assertNull(world.draggedBlockId);
  assertFalse(block.isDragging);
});

test('getTowerHeight calculates height from ground', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ y: 400, height: 50 });
  addBlock(world, block);
  assertEqual(getTowerHeight(world), 200); // 600 - 400
});

test('clearBlocks removes all blocks', () => {
  const world = createWorld(400, 600);
  addBlock(world, createBlock());
  addBlock(world, createBlock());
  clearBlocks(world);
  assertEqual(world.blocks.length, 0);
});

test('step updates physics for all blocks', () => {
  const world = createWorld(400, 600);
  const block = createBlock({ x: 100, y: 100, vx: 100 });
  addBlock(world, block);
  step(world, 0.1);
  assertTrue(block.x > 100); // Moved by velocity
  assertTrue(block.vy > 0); // Affected by gravity
});

test('step does nothing when paused', () => {
  const world = createWorld(400, 600);
  world.paused = true;
  const block = createBlock({ x: 100, y: 100, vx: 100 });
  addBlock(world, block);
  step(world, 0.1);
  assertEqual(block.x, 100);
  assertEqual(block.vy, 0);
});

// ============ Friction Tests ============

test('isRestingOn detects block resting on another', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50 }); // bottom of top = 100 = top of bottom
  assertTrue(isRestingOn(top, bottom));
});

test('isRestingOn returns false when blocks not touching vertically', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  const top = createBlock({ x: 100, y: 40, width: 50, height: 50 }); // gap between them
  assertFalse(isRestingOn(top, bottom));
});

test('isRestingOn returns false when blocks not overlapping horizontally', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  const top = createBlock({ x: 200, y: 50, width: 50, height: 50 }); // different x position
  assertFalse(isRestingOn(top, bottom));
});

test('getBlocksRestingOn finds blocks on top', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50 });
  const unrelated = createBlock({ x: 300, y: 50, width: 50, height: 50 });
  const blocks = [bottom, top, unrelated];

  const resting = getBlocksRestingOn(bottom, blocks);
  assertEqual(resting.length, 1);
  assertEqual(resting[0], top);
});

test('applyDragFriction moves blocks on top with high friction', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, friction: 1.0 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 1.0 });
  bottom.isDragging = true;
  const blocks = [bottom, top];

  applyDragFriction(bottom, blocks, 20, 0, 0.016); // drag right by 20, ~60fps

  // With friction = 1.0, top should move fully with bottom
  assertEqual(top.x, 120);
});

test('applyDragFriction moves blocks less with low friction', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, friction: 0.5 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 0.5 });
  bottom.isDragging = true;
  const blocks = [bottom, top];

  applyDragFriction(bottom, blocks, 20, 0, 0.016); // drag right by 20

  // With friction = 0.5, top should move partially
  assertTrue(top.x > 100); // moved
  assertTrue(top.x < 120); // but not fully
});

test('applyDragFriction sticky blocks move fully with dragged block', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, sticky: true });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 0.1 });
  bottom.isDragging = true;
  const blocks = [bottom, top];

  applyDragFriction(bottom, blocks, 20, 0, 0.016);

  // Sticky bottom means top moves 100%
  assertEqual(top.x, 120);
});

test('applyDragFriction slippery blocks have very low friction', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, slippery: true, friction: 0.5 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 0.5 });
  bottom.isDragging = true;
  const blocks = [bottom, top];

  applyDragFriction(bottom, blocks, 20, 0, 0.016);

  // Slippery means very low effective friction
  assertTrue(top.x < 105); // barely moved
});

test('applyDragFriction cascades to multiple levels', () => {
  const bottom = createBlock({ x: 100, y: 150, width: 50, height: 50, friction: 1.0 });
  const middle = createBlock({ x: 100, y: 100, width: 50, height: 50, friction: 1.0 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 1.0 });
  bottom.isDragging = true;
  const blocks = [bottom, middle, top];

  applyDragFriction(bottom, blocks, 20, 0, 0.016);

  // All blocks should move with full friction
  assertEqual(middle.x, 120);
  assertEqual(top.x, 120);
});

test('applyDragFriction sets velocity for inertia', () => {
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, friction: 1.0 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 1.0 });
  bottom.isDragging = true;
  const blocks = [bottom, top];

  // Move 20 pixels in 0.016 seconds (16ms frame)
  applyDragFriction(bottom, blocks, 20, 0, 0.016);

  // Top should have velocity = dx / dt = 20 / 0.016 = 1250 px/s
  assertApprox(top.vx, 1250, 1);
});

test('dragging block moves blocks on top via updateDrag', () => {
  const world = createWorld(400, 600);
  const bottom = createBlock({ x: 100, y: 100, width: 50, height: 50, friction: 1.0 });
  const top = createBlock({ x: 100, y: 50, width: 50, height: 50, friction: 1.0 });
  addBlock(world, bottom);
  addBlock(world, top);

  startDrag(world, bottom.id, 125, 125); // center of bottom block
  updateDrag(world, 145, 125); // move 20 pixels right

  assertEqual(bottom.x, 120); // moved 20 right
  assertEqual(top.x, 120); // should also move 20 right with high friction
});

console.log('\\n=== All tests complete ===');
