import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVolumeState } from '../src/devices/television.js';

test('reads the legacy top-level volume/muted shape', () => {
  assert.deepEqual(extractVolumeState({ volume: 12, muted: true }), {
    volume: 12,
    muted: true,
  });
});

test('reads the recent volumeStatus shape (volume + muteStatus)', () => {
  assert.deepEqual(
    extractVolumeState({ returnValue: true, volumeStatus: { volume: 7, muteStatus: true } }),
    { volume: 7, muted: true },
  );
});

test('top-level values win over volumeStatus when both are present', () => {
  assert.deepEqual(
    extractVolumeState({ volume: 3, muted: false, volumeStatus: { volume: 99, muteStatus: true } }),
    { volume: 3, muted: false },
  );
});

test('returns undefined for missing fields', () => {
  assert.deepEqual(extractVolumeState({}), { volume: undefined, muted: undefined });
  assert.deepEqual(extractVolumeState(), { volume: undefined, muted: undefined });
});

test('unmute is read as muted:false, not dropped', () => {
  assert.equal(extractVolumeState({ volumeStatus: { muteStatus: false } }).muted, false);
});
