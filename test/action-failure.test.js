import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionFailure } from '../src/action-failure.js';

test('ActionFailure keeps the multi-language object as its message', () => {
  const payload = { en: 'Unreachable.', fr: 'Injoignable.', de: 'Nicht erreichbar.' };
  const error = new ActionFailure(payload);

  assert.ok(error instanceof Error);
  assert.equal(error.name, 'ActionFailure');
  // The SDK relays err.message as-is: it must stay the multi-language object.
  assert.deepEqual(error.message, payload);
});

test('ActionFailure accepts a plain string message too', () => {
  const error = new ActionFailure('Boom');

  assert.equal(error.message, 'Boom');
});
