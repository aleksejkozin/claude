// Simple test runner - works in browser, no build tools needed

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

export function test(name, fn) {
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
