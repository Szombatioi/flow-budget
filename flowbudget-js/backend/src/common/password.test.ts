import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStrongPassword } from './password.js';

test('requires three character classes', () => {
  assert.ok(!isStrongPassword('alllowercaseletters'));
  assert.ok(!isStrongPassword('lowercase12345'));
  assert.ok(isStrongPassword('Lowercase12345'));
  assert.ok(isStrongPassword('lower-case-12345'));
  assert.ok(isStrongPassword('Ünnepi Kalács!'));
});
