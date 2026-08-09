import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMagicPacket } from '../src/wol.js';

test('builds a standard 102-byte Wake-on-LAN magic packet', () => {
  const packet = buildMagicPacket('AA:BB:CC:DD:EE:FF');
  assert.equal(packet.length, 102);
  assert.equal(packet.subarray(0, 6).toString('hex'), 'ffffffffffff');
  assert.equal(packet.subarray(6, 12).toString('hex'), 'aabbccddeeff');
  assert.equal(packet.subarray(96, 102).toString('hex'), 'aabbccddeeff');
});
