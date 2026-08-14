import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeMac, validateConfig } from '../src/config.js';

test('normalizes MAC addresses', () => {
  assert.equal(normalizeMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeMac(''), '');
});

test('normalizes discovery configuration', () => {
  assert.deepEqual(
    normalizeConfig({ tv_ip: ' 192.168.1.20 ', tv_mac: 'aabbccddeeff', tv_udn: 'UUID:ABC-123' }),
    {
      tv_ip: '192.168.1.20',
      tv_mac: 'AA:BB:CC:DD:EE:FF',
      tv_name: 'LG webOS TV',
      tv_udn: 'uuid:abc-123',
      tv_platform_id: '',
      connection_mode: 'auto',
      client_key: '',
    },
  );
});

test('MAC is optional but IP is required to connect', () => {
  assert.doesNotThrow(() => validateConfig(normalizeConfig({ tv_ip: '192.168.1.20' })));
  assert.throws(() => validateConfig(normalizeConfig({ tv_ip: '' })));
  assert.throws(() =>
    validateConfig(normalizeConfig({ tv_ip: '192.168.1.20', tv_mac: 'bad-mac' })),
  );
});

test('normalizes empty, null and invalid configuration values', () => {
  assert.deepEqual(normalizeConfig(), {
    tv_ip: '',
    tv_mac: '',
    tv_name: 'LG webOS TV',
    tv_udn: '',
    tv_platform_id: '',
    connection_mode: 'auto',
    client_key: '',
  });

  assert.deepEqual(
    normalizeConfig({
      tv_ip: null,
      tv_mac: null,
      tv_name: '',
      tv_udn: null,
      tv_platform_id: null,
      connection_mode: 'invalid',
      client_key: null,
    }),
    {
      tv_ip: '',
      tv_mac: '',
      tv_name: 'LG webOS TV',
      tv_udn: '',
      tv_platform_id: '',
      connection_mode: 'auto',
      client_key: '',
    },
  );
});

test('keeps an invalid-length MAC normalized to uppercase', () => {
  assert.equal(normalizeMac(' aa-bb-cc '), 'AA-BB-CC');
});

test('rejects a missing TV IP address', () => {
  assert.throws(() => validateConfig({ tv_ip: '', tv_mac: '' }), /TV IP address is required/);
});

test('rejects an invalid TV IP address', () => {
  assert.throws(
    () => validateConfig({ tv_ip: 'not-an-ip', tv_mac: '' }),
    /TV IP address is invalid/,
  );
});

test('rejects an invalid TV MAC address', () => {
  assert.throws(
    () => validateConfig({ tv_ip: '192.168.1.71', tv_mac: 'INVALID' }),
    /TV MAC address is invalid/,
  );
});

test('accepts a valid configuration without a MAC address', () => {
  assert.doesNotThrow(() =>
    validateConfig({
      tv_ip: '192.168.1.71',
      tv_mac: '',
    }),
  );
});

test('accepts a valid configuration with a MAC address', () => {
  assert.doesNotThrow(() =>
    validateConfig({
      tv_ip: '192.168.1.71',
      tv_mac: '64:E4:A5:B4:88:74',
    }),
  );
});
