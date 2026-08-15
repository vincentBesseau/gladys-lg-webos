import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTelevisionRuntime,
  createTelevisionRuntimeRegistry,
} from '../src/runtime/televisions.js';
import { FEATURE_KEYS, setTelevisionValue } from '../src/devices/television.js';
import { WEBOS_COMMANDS } from '../src/webos/commands.js';

function createGladys() {
  return {
    externalIds(integration, hardwareId) {
      return {
        device: `ext:${integration}:${hardwareId}`,
        feature: (key) => `ext:${integration}:${hardwareId}:${key}`,
      };
    },
  };
}

test('creates an isolated runtime', () => {
  const runtime = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_platform_id: 'tv-a',
    client_key: 'key-a',
  });

  assert.equal(runtime.config.tv_ip, '192.168.1.71');
  assert.equal(runtime.config.tv_platform_id, 'tv-a');
  assert.equal(runtime.config.client_key, 'key-a');
  assert.equal(runtime.client, null);
  assert.equal(runtime.wakingUp, false);
  assert.equal(typeof runtime.stopSubscriptions, 'function');
});

test('registers and retrieves two independent television runtimes', () => {
  const gladys = createGladys();
  const defaultRuntime = createTelevisionRuntime();

  const registry = createTelevisionRuntimeRegistry(gladys, defaultRuntime);

  const runtimeA = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_platform_id: 'tv-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_ip: '192.168.1.72',
    tv_platform_id: 'tv-b',
  });

  const deviceA = registry.registerRuntime(runtimeA);
  const deviceB = registry.registerRuntime(runtimeB);

  assert.equal(registry.getRuntimeForDevice(deviceA), runtimeA);
  assert.equal(registry.getRuntimeForDevice(deviceB), runtimeB);
  assert.notEqual(runtimeA, runtimeB);
});

test('keeps clients and client keys isolated between televisions', () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const runtimeA = createTelevisionRuntime({
    tv_platform_id: 'tv-a',
    client_key: 'key-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_platform_id: 'tv-b',
    client_key: 'key-b',
  });

  const clientA = {
    name: 'client-a',
  };

  const clientB = {
    name: 'client-b',
  };

  runtimeA.client = clientA;
  runtimeB.client = clientB;

  registry.registerRuntime(runtimeA);
  registry.registerRuntime(runtimeB);

  assert.equal(runtimeA.client, clientA);
  assert.equal(runtimeB.client, clientB);

  assert.equal(runtimeA.config.client_key, 'key-a');
  assert.equal(runtimeB.config.client_key, 'key-b');
});

test('finds a runtime by UDN or IP', () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const runtime = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:tv-a',
    tv_platform_id: 'tv-a',
  });

  registry.registerRuntime(runtime);

  assert.equal(
    registry.findRuntimeForTelevision({
      udn: 'uuid:tv-a',
      ip: '192.168.1.99',
    }),
    runtime,
  );

  assert.equal(
    registry.findRuntimeForTelevision({
      udn: 'uuid:other',
      ip: '192.168.1.71',
    }),
    runtime,
  );
});

test('uses platform id, UDN then MAC as runtime id', () => {
  const registry = createTelevisionRuntimeRegistry(createGladys(), createTelevisionRuntime());

  assert.equal(
    registry.getRuntimeId(
      createTelevisionRuntime({
        tv_platform_id: 'platform',
        tv_udn: 'udn',
        tv_mac: 'AA:BB:CC:DD:EE:FF',
      }),
    ),
    'platform',
  );

  assert.equal(
    registry.getRuntimeId(
      createTelevisionRuntime({
        tv_udn: 'udn',
        tv_mac: 'AA:BB:CC:DD:EE:FF',
      }),
    ),
    'udn',
  );

  assert.equal(
    registry.getRuntimeId(
      createTelevisionRuntime({
        tv_mac: 'AA:BB:CC:DD:EE:FF',
      }),
    ),
    'AA:BB:CC:DD:EE:FF',
  );
});

test('throws when retrieving an unknown device runtime', () => {
  const registry = createTelevisionRuntimeRegistry(createGladys(), createTelevisionRuntime());

  assert.throws(
    () =>
      registry.getRuntimeForDevice({
        external_id: 'unknown',
      }),
    /No LG webOS runtime found/,
  );
});

test('does not register a runtime without a stable hardware identifier', () => {
  const registry = createTelevisionRuntimeRegistry(createGladys(), createTelevisionRuntime());

  const runtime = createTelevisionRuntime();

  assert.equal(registry.registerRuntime(runtime), null);
  assert.equal(registry.getUniqueRuntimes().length, 0);
});

test('does not create a second runtime for an already registered device', () => {
  const gladys = createGladys();

  const defaultRuntime = createTelevisionRuntime({
    connection_mode: 'wss',
  });

  const registry = createTelevisionRuntimeRegistry(gladys, defaultRuntime);

  const runtime = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:tv-a',
    tv_platform_id: 'tv-a',
  });

  const device = registry.registerRuntime(runtime);

  const result = registry.getOrCreateRuntimeForDevice(device);

  assert.equal(result, runtime);
  assert.equal(registry.getUniqueRuntimes().length, 1);
});

test('creates a runtime from a discovered device', () => {
  const gladys = createGladys();

  const defaultRuntime = createTelevisionRuntime({
    connection_mode: 'wss',
  });

  const registry = createTelevisionRuntimeRegistry(gladys, defaultRuntime);

  const device = {
    name: 'TV Chambre',
    external_id: 'ext:lg-webos:tv-chambre',
    params: [
      {
        name: 'ip',
        value: '192.168.1.72',
      },
      {
        name: 'mac',
        value: 'AA:BB:CC:DD:EE:FF',
      },
      {
        name: 'udn',
        value: 'uuid:tv-chambre',
      },
      {
        name: 'platform_id',
        value: 'tv-chambre',
      },
    ],
  };

  const runtime = registry.getOrCreateRuntimeForDevice(device);

  assert.equal(runtime.config.tv_ip, '192.168.1.72');
  assert.equal(runtime.config.tv_mac, 'AA:BB:CC:DD:EE:FF');
  assert.equal(runtime.config.tv_udn, 'uuid:tv-chambre');
  assert.equal(runtime.config.tv_platform_id, 'tv-chambre');
  assert.equal(runtime.config.tv_name, 'TV Chambre');
  assert.equal(runtime.config.connection_mode, 'wss');
});

test('clears all registered runtimes', () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  registry.registerRuntime(
    createTelevisionRuntime({
      tv_platform_id: 'tv-a',
    }),
  );

  registry.registerRuntime(
    createTelevisionRuntime({
      tv_platform_id: 'tv-b',
    }),
  );

  assert.equal(registry.getUniqueRuntimes().length, 2);

  registry.clearRuntimes();

  assert.equal(registry.getUniqueRuntimes().length, 0);
});

test('routes each Gladys device to its own runtime and client', () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const runtimeA = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_platform_id: 'tv-a',
    client_key: 'key-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_ip: '192.168.1.72',
    tv_platform_id: 'tv-b',
    client_key: 'key-b',
  });

  runtimeA.client = {
    name: 'client-a',
    requests: [],
  };

  runtimeB.client = {
    name: 'client-b',
    requests: [],
  };

  const deviceA = registry.registerRuntime(runtimeA);
  const deviceB = registry.registerRuntime(runtimeB);

  const selectedRuntimeA = registry.getRuntimeForDevice(deviceA);
  const selectedRuntimeB = registry.getRuntimeForDevice(deviceB);

  selectedRuntimeA.client.requests.push({
    command: 'volume-up',
  });

  selectedRuntimeB.client.requests.push({
    command: 'volume-down',
  });

  assert.equal(selectedRuntimeA, runtimeA);
  assert.equal(selectedRuntimeB, runtimeB);

  assert.deepEqual(runtimeA.client.requests, [
    {
      command: 'volume-up',
    },
  ]);

  assert.deepEqual(runtimeB.client.requests, [
    {
      command: 'volume-down',
    },
  ]);
});

test('never resolves a television device to another television runtime', () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const runtimeA = createTelevisionRuntime({
    tv_platform_id: 'tv-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_platform_id: 'tv-b',
  });

  const deviceA = registry.registerRuntime(runtimeA);
  const deviceB = registry.registerRuntime(runtimeB);

  assert.equal(registry.getRuntimeForDevice(deviceA), runtimeA);

  assert.notEqual(registry.getRuntimeForDevice(deviceA), runtimeB);

  assert.equal(registry.getRuntimeForDevice(deviceB), runtimeB);

  assert.notEqual(registry.getRuntimeForDevice(deviceB), runtimeA);
});

test('sends a television command only to the client belonging to the targeted device', async () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const requestsA = [];
  const requestsB = [];

  const runtimeA = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_platform_id: 'tv-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_ip: '192.168.1.72',
    tv_platform_id: 'tv-b',
  });

  runtimeA.client = {
    async request(command, payload) {
      requestsA.push({
        command,
        payload,
      });

      return {};
    },
  };

  runtimeB.client = {
    async request(command, payload) {
      requestsB.push({
        command,
        payload,
      });

      return {};
    },
  };

  const deviceA = registry.registerRuntime(runtimeA);

  registry.registerRuntime(runtimeB);

  const selectedRuntime = registry.getRuntimeForDevice(deviceA);

  const volumeFeature = deviceA.features.find((feature) => feature.type === FEATURE_KEYS.VOLUME);

  await setTelevisionValue({
    gladys,
    client: selectedRuntime.client,
    config: selectedRuntime.config,
    feature: volumeFeature,
    value: 42,
  });

  assert.deepEqual(requestsA, [
    {
      command: WEBOS_COMMANDS.SET_VOLUME,
      payload: {
        volume: 42,
      },
    },
  ]);

  assert.deepEqual(requestsB, []);
});

test('routes independent commands to two television clients', async () => {
  const gladys = createGladys();

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const requestsA = [];
  const requestsB = [];

  const runtimeA = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_platform_id: 'tv-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_ip: '192.168.1.72',
    tv_platform_id: 'tv-b',
  });

  runtimeA.client = {
    async request(command, payload) {
      requestsA.push({
        command,
        payload,
      });

      return {};
    },
  };

  runtimeB.client = {
    async request(command, payload) {
      requestsB.push({
        command,
        payload,
      });

      return {};
    },
  };

  const deviceA = registry.registerRuntime(runtimeA);
  const deviceB = registry.registerRuntime(runtimeB);

  const selectedRuntimeA = registry.getRuntimeForDevice(deviceA);
  const selectedRuntimeB = registry.getRuntimeForDevice(deviceB);

  const volumeUpFeature = deviceA.features.find(
    (feature) => feature.type === FEATURE_KEYS.VOLUME_UP,
  );

  const muteFeature = deviceB.features.find((feature) => feature.type === FEATURE_KEYS.MUTE);

  await setTelevisionValue({
    gladys,
    client: selectedRuntimeA.client,
    config: selectedRuntimeA.config,
    feature: volumeUpFeature,
    value: 1,
  });

  await setTelevisionValue({
    gladys,
    client: selectedRuntimeB.client,
    config: selectedRuntimeB.config,
    feature: muteFeature,
    value: 1,
  });

  assert.deepEqual(requestsA, [
    {
      command: WEBOS_COMMANDS.VOLUME_UP,
      payload: undefined,
    },
  ]);

  assert.deepEqual(requestsB, [
    {
      command: WEBOS_COMMANDS.SET_MUTE,
      payload: {
        mute: true,
      },
    },
  ]);
});

test('uses the MAC address belonging to the targeted television for Wake-on-LAN', async () => {
  const wakeOnLanCalls = [];

  const gladys = {
    ...createGladys(),

    async wakeOnLan(mac, options) {
      wakeOnLanCalls.push({
        mac,
        options,
      });
    },
  };

  const registry = createTelevisionRuntimeRegistry(gladys, createTelevisionRuntime());

  const runtimeA = createTelevisionRuntime({
    tv_ip: '192.168.1.71',
    tv_mac: '64:E4:A5:B4:88:74',
    tv_platform_id: 'tv-a',
  });

  const runtimeB = createTelevisionRuntime({
    tv_ip: '192.168.1.72',
    tv_mac: 'AA:BB:CC:DD:EE:FF',
    tv_platform_id: 'tv-b',
  });

  const deviceA = registry.registerRuntime(runtimeA);

  registry.registerRuntime(runtimeB);

  const selectedRuntime = registry.getRuntimeForDevice(deviceA);

  const powerFeature = deviceA.features.find((feature) => feature.type === FEATURE_KEYS.POWER);

  await setTelevisionValue({
    gladys,
    client: null,
    config: selectedRuntime.config,
    feature: powerFeature,
    value: 1,
  });

  assert.deepEqual(wakeOnLanCalls, [
    {
      mac: '64:E4:A5:B4:88:74',
      options: {
        address: '192.168.1.255',
        port: 9,
        sourcePort: 0,
      },
    },
  ]);
});
