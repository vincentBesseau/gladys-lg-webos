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
  assert.throws(() => validateConfig(normalizeConfig({ tv_ip: '192.168.1.20', tv_mac: 'bad-mac' })));
});
