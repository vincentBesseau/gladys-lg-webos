import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeConfig,
  normalizeMac,
  normalizeTelevisionsConfig,
  validateConfig,
} from '../src/config.js';

test('normalizes MAC addresses', () => {
  assert.equal(normalizeMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizeMac(''), '');
});

test('normalizes discovery configuration', () => {
  assert.deepEqual(
    normalizeConfig({
      tv_ip: ' 192.168.1.20 ',
      tv_mac: 'aabbccddeeff',
      tv_udn: 'UUID:ABC-123',
    }),
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
  assert.doesNotThrow(() =>
    validateConfig(
      normalizeConfig({
        tv_ip: '192.168.1.20',
      }),
    ),
  );

  assert.throws(() =>
    validateConfig(
      normalizeConfig({
        tv_ip: '',
      }),
    ),
  );

  assert.throws(() =>
    validateConfig(
      normalizeConfig({
        tv_ip: '192.168.1.20',
        tv_mac: 'bad-mac',
      }),
    ),
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
  assert.throws(
    () =>
      validateConfig({
        tv_ip: '',
        tv_mac: '',
      }),
    /TV IP address is required/,
  );
});

test('rejects an invalid TV IP address', () => {
  assert.throws(
    () =>
      validateConfig({
        tv_ip: 'not-an-ip',
        tv_mac: '',
      }),
    /TV IP address is invalid/,
  );
});

test('rejects an invalid TV MAC address', () => {
  assert.throws(
    () =>
      validateConfig({
        tv_ip: '192.168.1.71',
        tv_mac: 'INVALID',
      }),
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

test('migrates a legacy single-TV configuration to televisions', () => {
  assert.deepEqual(
    normalizeTelevisionsConfig({
      tv_ip: '192.168.1.71',
      tv_mac: '64:e4:a5:b4:88:74',
      tv_name: 'Salon',
      tv_udn: 'UUID:TV-SALON',
      tv_platform_id: 'TV-SALON',
      connection_mode: 'ws',
      client_key: 'salon-key',
    }),
    {
      'tv-salon': {
        tv_ip: '192.168.1.71',
        tv_mac: '64:E4:A5:B4:88:74',
        tv_name: 'Salon',
        tv_udn: 'uuid:tv-salon',
        tv_platform_id: 'tv-salon',
        connection_mode: 'ws',
        client_key: 'salon-key',
      },
    },
  );
});

test('normalizes multiple televisions independently', () => {
  assert.deepEqual(
    normalizeTelevisionsConfig({
      connection_mode: 'auto',
      televisions: {
        salon: {
          tv_ip: '192.168.1.71',
          tv_mac: '64:e4:a5:b4:88:74',
          tv_name: 'Salon',
          tv_udn: 'UUID:SALON',
          tv_platform_id: 'SALON',
          client_key: 'salon-key',
        },
        chambre: {
          tv_ip: '192.168.1.72',
          tv_mac: 'aa-bb-cc-dd-ee-ff',
          tv_name: 'Chambre',
          tv_udn: 'UUID:CHAMBRE',
          tv_platform_id: 'CHAMBRE',
          connection_mode: 'wss',
          client_key: 'chambre-key',
        },
      },
    }),
    {
      salon: {
        tv_ip: '192.168.1.71',
        tv_mac: '64:E4:A5:B4:88:74',
        tv_name: 'Salon',
        tv_udn: 'uuid:salon',
        tv_platform_id: 'salon',
        connection_mode: 'auto',
        client_key: 'salon-key',
      },
      chambre: {
        tv_ip: '192.168.1.72',
        tv_mac: 'AA:BB:CC:DD:EE:FF',
        tv_name: 'Chambre',
        tv_udn: 'uuid:chambre',
        tv_platform_id: 'chambre',
        connection_mode: 'wss',
        client_key: 'chambre-key',
      },
    },
  );
});

test('keeps a distinct client key for each television', () => {
  const televisions = normalizeTelevisionsConfig({
    televisions: {
      tv1: {
        tv_platform_id: 'tv1',
        tv_ip: '192.168.1.71',
        client_key: 'key-one',
      },
      tv2: {
        tv_platform_id: 'tv2',
        tv_ip: '192.168.1.72',
        client_key: 'key-two',
      },
    },
  });

  assert.equal(televisions.tv1.client_key, 'key-one');
  assert.equal(televisions.tv2.client_key, 'key-two');
});

test('inherits the global connection mode when a television does not define one', () => {
  const televisions = normalizeTelevisionsConfig({
    connection_mode: 'wss',
    televisions: {
      salon: {
        tv_platform_id: 'salon',
        tv_ip: '192.168.1.71',
      },
    },
  });

  assert.equal(televisions.salon.connection_mode, 'wss');
});

test('keeps a television-specific connection mode', () => {
  const televisions = normalizeTelevisionsConfig({
    connection_mode: 'auto',
    televisions: {
      salon: {
        tv_platform_id: 'salon',
        tv_ip: '192.168.1.71',
        connection_mode: 'ws',
      },
    },
  });

  assert.equal(televisions.salon.connection_mode, 'ws');
});

test('ignores invalid television entries', () => {
  assert.deepEqual(
    normalizeTelevisionsConfig({
      televisions: {
        valid: {
          tv_platform_id: 'valid',
          tv_ip: '192.168.1.71',
        },
        nullValue: null,
        arrayValue: [],
        stringValue: 'invalid',
      },
    }),
    {
      valid: {
        tv_ip: '192.168.1.71',
        tv_mac: '',
        tv_name: 'LG webOS TV',
        tv_udn: '',
        tv_platform_id: 'valid',
        connection_mode: 'auto',
        client_key: '',
      },
    },
  );
});

test('uses platform id before UDN, MAC and persisted key', () => {
  const televisions = normalizeTelevisionsConfig({
    televisions: {
      'persisted-key': {
        tv_platform_id: 'PLATFORM-ID',
        tv_udn: 'UUID:UDN-ID',
        tv_mac: 'AA:BB:CC:DD:EE:FF',
        tv_ip: '192.168.1.71',
      },
    },
  });

  assert.deepEqual(Object.keys(televisions), ['platform-id']);
});

test('uses UDN before MAC and persisted key when platform id is missing', () => {
  const televisions = normalizeTelevisionsConfig({
    televisions: {
      'persisted-key': {
        tv_udn: 'UUID:UDN-ID',
        tv_mac: 'AA:BB:CC:DD:EE:FF',
        tv_ip: '192.168.1.71',
      },
    },
  });

  assert.deepEqual(Object.keys(televisions), ['uuid:udn-id']);
});

test('uses MAC before persisted key when platform id and UDN are missing', () => {
  const televisions = normalizeTelevisionsConfig({
    televisions: {
      'persisted-key': {
        tv_mac: 'AA:BB:CC:DD:EE:FF',
        tv_ip: '192.168.1.71',
      },
    },
  });

  assert.deepEqual(Object.keys(televisions), ['aa:bb:cc:dd:ee:ff']);
});

test('falls back to the persisted key when no stable identifier is present', () => {
  const televisions = normalizeTelevisionsConfig({
    televisions: {
      'Persisted-Key': {
        tv_ip: '192.168.1.71',
      },
    },
  });

  assert.deepEqual(Object.keys(televisions), ['persisted-key']);
});

test('returns an empty televisions map for an empty legacy configuration', () => {
  assert.deepEqual(normalizeTelevisionsConfig({}), {});
});
