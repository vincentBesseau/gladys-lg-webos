import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeMac, validateConfig } from '../src/config.js';

test('normalizes MAC addresses', () => {
  assert.equal(normalizeMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
});

test('normalizes configuration', () => {
  assert.deepEqual(normalizeConfig({ tv_ip: ' 192.168.1.20 ', tv_mac: 'aabbccddeeff' }), {
    tv_ip: '192.168.1.20',
    tv_mac: 'AA:BB:CC:DD:EE:FF',
    tv_name: 'LG webOS TV',
    connection_mode: 'auto',
    client_key: '',
  });
});

test('validates required TV configuration', () => {
  assert.doesNotThrow(() => validateConfig(normalizeConfig({ tv_ip: '192.168.1.20', tv_mac: 'AA:BB:CC:DD:EE:FF' })));
  assert.throws(() => validateConfig(normalizeConfig({ tv_ip: '', tv_mac: 'AA:BB:CC:DD:EE:FF' })));
});
