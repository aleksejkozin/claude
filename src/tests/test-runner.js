// Simple test runner - works in browser, no build tools needed

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

// Test filter - set via command line arg or setFilter()
let testFilter = null;

// Check for Node.js command line filter
if (typeof process !== 'undefined' && process.argv) {
  const filterArg = process.argv[2];
  if (filterArg) {
    testFilter = filterArg.toLowerCase();
    console.log(`Running tests matching: "${filterArg}"\n`);
  }
}

export function setFilter(filter) {
  testFilter = filter ? filter.toLowerCase() : null;
}

export function test(name, fn) {
  // Skip if filter set and name doesn't match
  if (testFilter && !name.toLowerCase().includes(testFilter)) {
    results.skipped++;
    return;
  }

  try {
    fn();
    results.passed++;
    results.tests.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

export function assertApprox(actual, expected, tolerance = 0.001, message = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message} Expected ~${expected}, got ${actual}`);
  }
}

export function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} Expected true, got ${value}`);
  }
}

export function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} Expected false, got ${value}`);
  }
}

export function assertNotNull(value, message = '') {
  if (value === null || value === undefined) {
    throw new Error(`${message} Expected non-null value`);
  }
}

export function assertNull(value, message = '') {
  if (value !== null && value !== undefined) {
    throw new Error(`${message} Expected null, got ${value}`);
  }
}

export function assertAbove(top, bottom, tolerance = 0.1) {
  const topBottom = top.y + top.height;
  const bottomTop = bottom.y;
  if (topBottom > bottomTop + tolerance) {
    throw new Error(`Block not above: top.bottom=${topBottom.toFixed(3)}, bottom.top=${bottomTop.toFixed(3)}`);
  }
}

export function assertStacked(top, bottom, tolerance = 0.1) {
  const topBottom = top.y + top.height;
  const bottomTop = bottom.y;
  const gap = Math.abs(topBottom - bottomTop);
  if (gap > tolerance) {
    throw new Error(`Blocks not stacked: gap=${gap.toFixed(3)}m (tolerance=${tolerance})`);
  }
}

export function assertNoHorizontalSlip(block, originalX, tolerance = 0.01) {
  const drift = Math.abs(block.x - originalX);
  if (drift > tolerance) {
    throw new Error(`Horizontal slip: moved ${drift.toFixed(3)}m from x=${originalX}`);
  }
}

export function assertFollowedHorizontally(follower, leader, followerStartX, leaderStartX, tolerance = 0.1) {
  const leaderMovement = leader.x - leaderStartX;
  const followerMovement = follower.x - followerStartX;
  const slippage = Math.abs(leaderMovement - followerMovement);
  if (slippage > tolerance) {
    throw new Error(`Follower slipped: leader moved ${leaderMovement.toFixed(3)}m, follower moved ${followerMovement.toFixed(3)}m, slippage=${slippage.toFixed(3)}m`);
  }
}

export function assertMovedRight(block, originalX, minDistance = 0) {
  const movement = block.x - originalX;
  if (movement <= minDistance) {
    throw new Error(`Expected rightward movement > ${minDistance}m, got ${movement.toFixed(3)}m`);
  }
}

export function assertBounced(block) {
  if (block.vy >= 0) {
    throw new Error(`Expected upward velocity (bounce), got vy=${block.vy.toFixed(3)}`);
  }
}

export function assertSettled(block, velocityThreshold = 1) {
  if (Math.abs(block.vx) > velocityThreshold || Math.abs(block.vy) > velocityThreshold) {
    throw new Error(`Block not settled: vx=${block.vx.toFixed(3)}, vy=${block.vy.toFixed(3)}`);
  }
}

export function assertNoOverlap(block1, block2) {
  const b1 = { left: block1.x, right: block1.x + block1.width, top: block1.y, bottom: block1.y + block1.height };
  const b2 = { left: block2.x, right: block2.x + block2.width, top: block2.y, bottom: block2.y + block2.height };
  const overlapX = Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left);
  const overlapY = Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top);
  if (overlapX > 0 && overlapY > 0) {
    throw new Error(`Blocks overlap: overlapX=${overlapX.toFixed(3)}, overlapY=${overlapY.toFixed(3)}`);
  }
}

export function getResults() {
  return results;
}

export function renderResults(container) {
  const summary = document.createElement('div');
  summary.innerHTML = `
    <h2>Test Results</h2>
    <p style="color: ${results.failed === 0 ? '#0f0' : '#f00'}">
      ${results.passed} passed, ${results.failed} failed
    </p>
  `;
  container.appendChild(summary);

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';

  results.tests.forEach(test => {
    const li = document.createElement('li');
    li.style.padding = '5px';
    li.style.color = test.passed ? '#0f0' : '#f00';
    li.textContent = `${test.passed ? '✓' : '✗'} ${test.name}`;
    if (!test.passed) {
      const err = document.createElement('div');
      err.style.paddingLeft = '20px';
      err.style.fontSize = '12px';
      err.textContent = test.error;
      li.appendChild(err);
    }
    list.appendChild(li);
  });

  container.appendChild(list);
}
