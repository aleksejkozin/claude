#!/usr/bin/env node
// Run tests and update keyframe comments in test files

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import test helpers to access keyframe captures
import { getKeyframeCaptures } from './test-helpers.js';

// Run the tests
await import('./engine.test.js');

// Get captured keyframes
const keyframes = getKeyframeCaptures();

if (keyframes.length === 0) {
  console.log('No keyframes captured');
  process.exit(0);
}

console.log(`\nCaptured ${keyframes.length} keyframes. Updating test file...`);

// Update the test file
const testFilePath = path.join(__dirname, 'engine.test.js');
let content = fs.readFileSync(testFilePath, 'utf-8');

let keyframeIndex = 0;
content = content.replace(
  /\/\* KEYFRAME(?::\d+)?\s*\n[\s\S]*?\*\//g,
  (match) => {
    if (keyframeIndex < keyframes.length) {
      const kf = keyframes[keyframeIndex++];
      const indentedAscii = kf.ascii.split('\n').map(line => '     ' + line).join('\n');
      return `/* KEYFRAME:${kf.index}\n${indentedAscii}\n  */`;
    }
    return match;
  }
);

fs.writeFileSync(testFilePath, content);
console.log('Keyframes updated in engine.test.js');
