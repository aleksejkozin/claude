/**
 * Algorithm discovered from analyzing: foo("x2bktz7888", "abLkef") === "8887fzetkkkLbbb2ax"
 *
 * The algorithm:
 * 1. Find characters that appear in BOTH strings (shared characters)
 * 2. Iterate from the maximum length - 1 down to 0 (end to start)
 * 3. At each position i:
 *    - First process str2[i] if it exists
 *    - Then process str1[i] if it exists
 * 4. For each character:
 *    - If it's a shared character and hasn't been output yet: output it 3 times, mark as output
 *    - If it's a shared character and already output: skip it
 *    - If it's not shared: output it once
 */
function foo(str1, str2) {
  // Find characters that appear in both strings
  const chars1 = new Set(str1);
  const chars2 = new Set(str2);
  const sharedChars = new Set([...chars1].filter(c => chars2.has(c)));

  // Track which shared characters have been output
  const outputShared = new Set();

  let result = "";
  const maxLen = Math.max(str1.length, str2.length);

  // Iterate from the end (maxLen - 1) down to 0
  for (let i = maxLen - 1; i >= 0; i--) {
    // Process str2 first (if index exists)
    if (i < str2.length) {
      const c = str2[i];
      if (sharedChars.has(c)) {
        if (!outputShared.has(c)) {
          result += c.repeat(3);
          outputShared.add(c);
        }
      } else {
        result += c;
      }
    }

    // Then process str1
    if (i < str1.length) {
      const c = str1[i];
      if (sharedChars.has(c)) {
        if (!outputShared.has(c)) {
          result += c.repeat(3);
          outputShared.add(c);
        }
      } else {
        result += c;
      }
    }
  }

  return result;
}

// ============== TESTS ==============

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function runTests() {
  console.log("Running tests for foo()...\n");

  // Test 1: Original example from the problem
  assert(
    foo("x2bktz7888", "abLkef") === "8887fzetkkkLbbb2ax",
    "Original example: foo('x2bktz7888', 'abLkef') === '8887fzetkkkLbbb2ax'"
  );

  // Test 2: Both strings empty
  assert(
    foo("", "") === "",
    "Both empty strings: foo('', '') === ''"
  );

  // Test 3: First string empty
  assert(
    foo("", "abc") === "cba",
    "First string empty: foo('', 'abc') === 'cba' (reversed str2)"
  );

  // Test 4: Second string empty
  assert(
    foo("abc", "") === "cba",
    "Second string empty: foo('abc', '') === 'cba' (reversed str1)"
  );

  // Test 5: No shared characters - interleaves from end: z+c, y+b, x+a
  assert(
    foo("abc", "xyz") === "zcybxa",
    "No shared characters: foo('abc', 'xyz') === 'zcybxa'"
  );

  // Test 6: All characters shared - 'a' tripled first, then 'b' tripled
  assert(
    foo("ab", "ba") === "aaabbb",
    "All characters shared: foo('ab', 'ba') === 'aaabbb'"
  );

  // Test 7: Equal length strings with some shared ('c' and 'a')
  assert(
    foo("cat", "car") === "rtaaaccc",
    "Equal length with shared: foo('cat', 'car') === 'rtaaaccc'"
  );

  // Test 8: str2 longer than str1
  assert(
    foo("ab", "xyzab") === "bbbaaazyx",
    "str2 longer: foo('ab', 'xyzab') === 'bbbaaazyx'"
  );

  // Test 9: Single character strings, same
  assert(
    foo("a", "a") === "aaa",
    "Single same char: foo('a', 'a') === 'aaa'"
  );

  // Test 10: Single character strings, different
  assert(
    foo("a", "b") === "ba",
    "Single different chars: foo('a', 'b') === 'ba'"
  );

  // Test 11: Numbers only, all shared - order: 1,3 at pos2, 2 at pos1
  assert(
    foo("123", "321") === "111333222",
    "Numbers with all shared: foo('123', '321') === '111333222'"
  );

  // Test 12: Multiple occurrences of shared char in one string
  assert(
    foo("aaa", "a") === "aaa",
    "Multiple occurrences: foo('aaa', 'a') === 'aaa'"
  );

  // Test 13: Longer string with repeated chars
  assert(
    foo("xx", "yxy") === "yxxxy",
    "Repeated chars: foo('xx', 'yxy') === 'yxxxy'"
  );

  // Test 14: Mixed case (case sensitive) - 'A' and 'a' are different chars but both shared
  assert(
    foo("Aa", "aA") === "AAAaaa",
    "Case sensitive: foo('Aa', 'aA') === 'AAAaaa'"
  );

  console.log("\n All tests passed!");
}

// Run tests
runTests();

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = foo;
}
