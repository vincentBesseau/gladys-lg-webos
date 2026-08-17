import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistrationPayload } from '../src/webos/registration.js';

test('includes an existing client key when reconnecting', () => {
  const payload = buildRegistrationPayload('secret-key');
  assert.equal(payload['client-key'], 'secret-key');
  assert.equal(payload.pairingType, 'PROMPT');
  assert.ok(payload.manifest.permissions.includes('WRITE_NOTIFICATION_TOAST'));
  assert.ok(payload.manifest.permissions.includes('CONTROL_POWER'));
  assert.ok(payload.manifest.permissions.includes('CONTROL_MOUSE_AND_KEYBOARD'));
});
