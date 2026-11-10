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

test('sends an unsigned manifest so recent firmwares accept pairing', () => {
  const payload = buildRegistrationPayload();
  assert.equal(payload['client-key'], undefined);
  assert.equal(payload.manifest.manifestVersion, 1);
  assert.equal(payload.manifest.appVersion, '1.0.0');
  // Recent LG firmwares blacklist the historical signed test certificate.
  assert.equal(payload.manifest.signed, undefined);
  assert.equal(payload.manifest.signatures, undefined);
  assert.ok(Array.isArray(payload.manifest.permissions));
});
