import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscoveredTelevisionDevice,
  buildTelevisionDevice,
  paramsToObject,
} from '../src/devices/television.js';

const gladys = {
  externalIds: (type, id) => ({
    device: `ext:test:${type}:${id}`,
    feature: (key) => `ext:test:${type}:${id}:${key}`,
  }),
};

test('builds a discovered TV using the stable UDN', () => {
  const device = buildDiscoveredTelevisionDevice(
    gladys,
    {
      ip: '192.168.1.40',
      udn: 'uuid:ABC-123',
      name: '[LG] webOS TV',
      model: 'OLED55C3',
      serial: 'SERIAL',
      location: 'http://192.168.1.40/device.xml',
    },
    {},
  );

  assert.equal(device.external_id, 'ext:test:lg-webos:abc-123');
  assert.equal(device.model, 'OLED55C3');
  assert.deepEqual(paramsToObject(device), {
    ip: '192.168.1.40',
    udn: 'uuid:ABC-123',
    platform_id: 'uuid:ABC-123',
    location: 'http://192.168.1.40/device.xml',
    serial: 'SERIAL',
  });
});

test('keeps the legacy MAC external id when the same manually configured TV is discovered', () => {
  const device = buildDiscoveredTelevisionDevice(
    gladys,
    {
      ip: '192.168.1.40',
      udn: 'uuid:ABC-123',
      name: '[LG] webOS TV',
      model: '',
      serial: '',
      location: 'http://192.168.1.40/device.xml',
    },
    {
      tv_ip: '192.168.1.40',
      tv_mac: 'AA:BB:CC:DD:EE:FF',
      tv_udn: '',
      tv_platform_id: '',
      tv_name: 'TV salon',
    },
  );

  assert.equal(device.external_id, 'ext:test:lg-webos:aabbccddeeff');
});

test('discovery keeps its original platform id after a MAC is added', () => {
  const device = buildDiscoveredTelevisionDevice(
    gladys,
    {
      ip: '192.168.1.40',
      udn: 'uuid:ABC-123',
      name: '[LG] webOS TV',
      model: '',
      serial: '',
      location: 'http://192.168.1.40/device.xml',
    },
    {
      tv_ip: '192.168.1.40',
      tv_mac: 'AA:BB:CC:DD:EE:FF',
      tv_udn: 'uuid:abc-123',
      tv_platform_id: 'uuid:abc-123',
      tv_name: 'TV salon',
    },
  );
  assert.equal(device.external_id, 'ext:test:lg-webos:abc-123');
});

test('manual TV can be built without a MAC when it has an UDN', () => {
  const device = buildTelevisionDevice(gladys, {
    tv_ip: '192.168.1.40',
    tv_mac: '',
    tv_udn: 'uuid:ABC-123',
    tv_name: 'TV salon',
  });
  assert.equal(device.external_id, 'ext:test:lg-webos:abc-123');
});
