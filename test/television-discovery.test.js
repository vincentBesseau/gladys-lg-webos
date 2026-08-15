import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATURE_KEYS,
  buildDiscoveredTelevisionDevice,
  buildTelevisionDevice,
  getExternalInputs,
  getInstalledApplications,
  paramsToObject,
  publishPowerState,
  setTelevisionValue,
  startTelevisionSubscriptions,
} from '../src/devices/television.js';
import {
  WEBOS_SSDP_ST,
  discoverWebOsTelevisions,
  fetchDeviceDescription,
} from '../src/discovery/ssdp.js';
import { WEBOS_COMMANDS } from '../src/webos/commands.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

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

test('dispatches writable television features', async () => {
  const fakeGladys = createFakeGladys();
  const requests = [];

  const client = {
    request: async (uri, payload) => {
      requests.push({ uri, payload });
      return { returnValue: true };
    },
  };

  const config = {
    tv_ip: '192.168.1.71',
    tv_mac: '64:e4:a5:b4:88:74',
  };

  const feature = (key) => ({
    external_id: `lg-webos:test:${key}`,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client: null,
    config,
    feature: feature(FEATURE_KEYS.POWER),
    value: 1,
  });

  assert.deepEqual(fakeGladys.wakeOnLanCalls, [
    {
      mac: '64:e4:a5:b4:88:74',
      options: {
        address: '192.168.1.255',
        port: 9,
        sourcePort: 0,
      },
    },
  ]);

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.POWER),
    value: 0,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.VOLUME),
    value: 42.4,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.MUTE),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.VOLUME_UP),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.VOLUME_DOWN),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.PLAY),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.PAUSE),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.STOP),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.CHANNEL_UP),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.CHANNEL_DOWN),
    value: 1,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.TOAST),
    value: { text: 'Bonjour' },
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.SOURCE),
    value: 'HDMI_2',
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config,
    feature: feature(FEATURE_KEYS.LAUNCH_APP),
    value: 'netflix',
  });

  assert.deepEqual(requests, [
    {
      uri: WEBOS_COMMANDS.TURN_OFF,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.SET_VOLUME,
      payload: { volume: 42 },
    },
    {
      uri: WEBOS_COMMANDS.SET_MUTE,
      payload: { mute: true },
    },
    {
      uri: WEBOS_COMMANDS.VOLUME_UP,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.VOLUME_DOWN,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.PLAY,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.PAUSE,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.STOP,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.CHANNEL_UP,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.CHANNEL_DOWN,
      payload: undefined,
    },
    {
      uri: WEBOS_COMMANDS.CREATE_TOAST,
      payload: { message: 'Bonjour' },
    },
    {
      uri: WEBOS_COMMANDS.SWITCH_INPUT,
      payload: { inputId: 'HDMI_2' },
    },
    {
      uri: WEBOS_COMMANDS.LAUNCH_APP,
      payload: { id: 'netflix' },
    },
  ]);
});

test('rejects invalid writable television feature values', async () => {
  const fakeGladys = createFakeGladys();

  const client = {
    request: async () => ({ returnValue: true }),
  };

  const feature = (key) => ({
    external_id: `lg-webos:test:${key}`,
  });

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client: null,
      config: {
        tv_ip: '192.168.1.71',
        tv_mac: '',
      },
      feature: feature(FEATURE_KEYS.POWER),
      value: 1,
    }),
    /Wake-on-LAN requires the TV MAC address/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.TOAST),
      value: '   ',
    }),
    /Toast message cannot be empty/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.SOURCE),
      value: '',
    }),
    /Input id cannot be empty/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.LAUNCH_APP),
      value: '',
    }),
    /Application id cannot be empty/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature('unsupported'),
      value: 1,
    }),
    /Unsupported LG webOS feature/,
  );
});

test('normalizes installed applications and external inputs', async () => {
  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return {
          apps: [
            {
              id: 'netflix',
              title: 'Netflix',
              type: 'web',
              visible: true,
            },
            {
              id: 'hidden',
              title: '',
              visible: false,
            },
            {
              title: 'No id',
            },
          ],
        };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return {
          devices: [
            {
              id: 'HDMI_1',
              appId: 'com.webos.app.hdmi1',
              label: 'SFR',
              icon: '/icon.png',
              connected: true,
            },
            {
              id: 'HDMI_2',
              connected: false,
            },
            {
              label: 'No id',
            },
          ],
        };
      }

      throw new Error(`Unexpected URI ${uri}`);
    },
  };

  assert.deepEqual(await getInstalledApplications(client), [
    {
      id: 'netflix',
      title: 'Netflix',
      type: 'web',
      visible: true,
    },
    {
      id: 'hidden',
      title: 'hidden',
      type: '',
      visible: false,
    },
  ]);

  assert.deepEqual(await getExternalInputs(client), [
    {
      id: 'HDMI_1',
      appId: 'com.webos.app.hdmi1',
      label: 'SFR',
      icon: '/icon.png',
      connected: true,
    },
    {
      id: 'HDMI_2',
      appId: '',
      label: 'HDMI_2',
      icon: '',
      connected: false,
    },
  ]);
});

test('publishes subscriptions, dynamic app options and cleanup', async () => {
  const fakeGladys = createFakeGladys();
  const callbacks = new Map();
  const cleaned = [];

  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return {
          apps: [
            {
              id: 'netflix',
              title: 'Netflix',
              visible: true,
            },
            {
              id: 'hidden',
              title: 'Hidden',
              visible: false,
            },
          ],
        };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return {
          devices: [
            {
              id: 'HDMI_2',
              appId: 'com.webos.app.hdmi2',
              label: 'SAMSUNG',
              connected: true,
            },
          ],
        };
      }

      throw new Error(`Unexpected request ${uri}`);
    },

    subscribe: async (uri, callback) => {
      callbacks.set(uri, callback);
      return () => cleaned.push(uri);
    },
  };

  const config = {
    tv_name: 'TV',
    tv_ip: '192.168.1.71',
    tv_mac: '64:e4:a5:b4:88:74',
    tv_udn: 'uuid:test',
    tv_platform_id: 'test',
  };

  const cleanup = await startTelevisionSubscriptions(fakeGladys, client, config);

  assert.equal(fakeGladys.discoveredDevices.length, 1);

  const launchFeature = fakeGladys.discoveredDevices[0].features.find((item) =>
    item.external_id.endsWith(`:${FEATURE_KEYS.LAUNCH_APP}`),
  );

  assert.deepEqual(launchFeature.supported_options, [
    {
      value: 'netflix',
      label: 'Netflix',
    },
  ]);

  await callbacks.get(WEBOS_COMMANDS.GET_POWER_STATE)({
    state: 'Active',
  });

  await callbacks.get(WEBOS_COMMANDS.GET_POWER_STATE)({
    state: 'Suspend',
  });

  await callbacks.get(WEBOS_COMMANDS.FOREGROUND_APP)({
    appId: 'com.webos.app.hdmi2',
  });

  await callbacks.get(WEBOS_COMMANDS.GET_VOLUME)({
    volume: 12,
    muted: true,
  });

  assert.ok(fakeGladys.published.some((item) => item.state === 1));

  assert.ok(fakeGladys.published.some((item) => item.state === 0));

  assert.ok(fakeGladys.published.some((item) => item.text === 'SAMSUNG'));

  assert.ok(fakeGladys.published.some((item) => item.text === 'HDMI_2'));

  assert.ok(fakeGladys.published.some((item) => item.state === 12));

  cleanup();

  assert.deepEqual(
    cleaned.sort(),
    [
      WEBOS_COMMANDS.FOREGROUND_APP,
      WEBOS_COMMANDS.GET_POWER_STATE,
      WEBOS_COMMANDS.GET_VOLUME,
    ].sort(),
  );
});

test('subscriptions tolerate application and input discovery failures', async () => {
  const fakeGladys = createFakeGladys();
  const subscriptions = [];

  const client = {
    request: async () => {
      throw new Error('unavailable');
    },

    subscribe: async (uri) => {
      subscriptions.push(uri);
      return () => {};
    },
  };

  const cleanup = await startTelevisionSubscriptions(fakeGladys, client, {
    tv_name: 'TV',
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:test',
  });

  assert.equal(typeof cleanup, 'function');

  assert.deepEqual(
    subscriptions.sort(),
    [
      WEBOS_COMMANDS.FOREGROUND_APP,
      WEBOS_COMMANDS.GET_POWER_STATE,
      WEBOS_COMMANDS.GET_VOLUME,
    ].sort(),
  );
});

test('publishes explicit power state and ignores devices without a stable id', async () => {
  const fakeGladys = createFakeGladys();

  await publishPowerState(
    fakeGladys,
    {
      tv_udn: 'uuid:test',
      tv_name: 'TV',
    },
    1,
  );

  assert.equal(fakeGladys.published.at(-1).state, 1);

  const count = fakeGladys.published.length;

  await publishPowerState(
    fakeGladys,
    {
      tv_name: 'TV',
    },
    0,
  );

  assert.equal(fakeGladys.published.length, count);
});

test('fetchDeviceDescription handles missing location, HTTP errors and network errors', async () => {
  assert.deepEqual(await fetchDeviceDescription('', async () => {}), {});

  assert.deepEqual(
    await fetchDeviceDescription('http://192.168.1.10/device.xml', async () => ({
      ok: false,
    })),
    {},
  );

  assert.deepEqual(
    await fetchDeviceDescription('http://192.168.1.10/device.xml', async () => {
      throw new Error('network failure');
    }),
    {},
  );
});

test('fetchDeviceDescription parses XML values and entities', async () => {
  const details = await fetchDeviceDescription('http://192.168.1.10/device.xml', async () => ({
    ok: true,
    text: async () => `
        <root>
          <device>
            <friendlyName>TV &amp; Salon</friendlyName>
            <manufacturer>LG Electronics &lt;webOS&gt;</manufacturer>
            <modelName>OLED &quot;C7&quot;</modelName>
            <modelNumber>OLED55C7V</modelNumber>
            <serialNumber>ABC&apos;123</serialNumber>
            <UDN>uuid:ABC-123::urn:schemas-upnp-org:device:MediaRenderer:1</UDN>
          </device>
        </root>
      `,
  }));

  assert.deepEqual(details, {
    friendlyName: 'TV & Salon',
    manufacturer: 'LG Electronics <webOS>',
    modelName: 'OLED "C7"',
    modelNumber: 'OLED55C7V',
    serialNumber: "ABC'123",
    udn: 'uuid:abc-123',
  });
});

test('discovers a TV from raw SSDP string headers', async () => {
  const fakeGladys = {
    scanNetwork: async (type, options) => {
      assert.equal(type, 'ssdp');
      assert.deepEqual(options, {
        st: WEBOS_SSDP_ST,
        timeoutSeconds: 7,
      });

      return [
        {
          source_ip: '192.168.1.71',
          headers: [
            'HTTP/1.1 200 OK',
            'Location: http://192.168.1.71:1576/',
            'USN: uuid:ABC-123::urn:lge-com:service:webos-second-screen:1',
            `ST: ${WEBOS_SSDP_ST}`,
            '',
          ].join('\r\n'),
        },
      ];
    },
  };

  const televisions = await discoverWebOsTelevisions(fakeGladys, {
    timeoutSeconds: 7,
    fetchImpl: async () => ({
      ok: true,
      text: async () => `
        <root>
          <device>
            <friendlyName>TV Salon</friendlyName>
            <manufacturer>LG Electronics</manufacturer>
            <modelName>OLED55C7V</modelName>
            <serialNumber>SERIAL</serialNumber>
            <UDN>uuid:ABC-123</UDN>
          </device>
        </root>
      `,
    }),
  });

  assert.deepEqual(televisions, [
    {
      ip: '192.168.1.71',
      udn: 'uuid:abc-123',
      name: 'TV Salon',
      model: 'OLED55C7V',
      serial: 'SERIAL',
      location: 'http://192.168.1.71:1576/',
    },
  ]);
});

test('discovers a TV from object headers and derives the IP from Location', async () => {
  const fakeGladys = {
    scanNetwork: async () => [
      {
        headers: {
          LOCATION: 'http://192.168.1.72:1576/device.xml',
          USN: 'uuid:DEF-456::urn:lge-com:service:webos-second-screen:1',
          ST: WEBOS_SSDP_ST,
        },
      },
    ],
  };

  const televisions = await discoverWebOsTelevisions(fakeGladys, {
    fetchImpl: async () => ({
      ok: true,
      text: async () => `
        <root>
          <device>
            <manufacturer>webOS</manufacturer>
            <modelNumber>MODEL-72</modelNumber>
          </device>
        </root>
      `,
    }),
  });

  assert.deepEqual(televisions, [
    {
      ip: '192.168.1.72',
      udn: 'uuid:def-456',
      name: 'LG webOS TV (192.168.1.72)',
      model: 'MODEL-72',
      serial: '',
      location: 'http://192.168.1.72:1576/device.xml',
    },
  ]);
});

test('ignores SSDP responses with a different ST, missing identity or non-LG manufacturer', async () => {
  const fakeGladys = {
    scanNetwork: async () => [
      {
        source_ip: '192.168.1.10',
        headers: {
          location: 'http://192.168.1.10/device.xml',
          usn: 'uuid:wrong-st',
          st: 'urn:schemas-upnp-org:device:MediaRenderer:1',
        },
      },
      {
        source_ip: '',
        headers: {
          location: 'not-a-valid-url',
          usn: '',
          st: WEBOS_SSDP_ST,
        },
      },
      {
        source_ip: '192.168.1.11',
        headers: {
          location: 'http://192.168.1.11/device.xml',
          usn: 'uuid:not-lg',
          st: WEBOS_SSDP_ST,
        },
      },
    ],
  };

  const televisions = await discoverWebOsTelevisions(fakeGladys, {
    fetchImpl: async (location) => ({
      ok: true,
      text: async () =>
        location.includes('192.168.1.11')
          ? '<root><manufacturer>Samsung Electronics</manufacturer><UDN>uuid:not-lg</UDN></root>'
          : '<root></root>',
    }),
  });

  assert.deepEqual(televisions, []);
});

test('uses entry fields as SSDP headers and tolerates an empty scan result', async () => {
  const emptyGladys = {
    scanNetwork: async () => null,
  };

  assert.deepEqual(await discoverWebOsTelevisions(emptyGladys), []);

  const fakeGladys = {
    scanNetwork: async () => [
      {
        source_ip: '192.168.1.73',
        location: 'http://192.168.1.73/device.xml',
        usn: 'uuid:GHI-789::something',
        st: WEBOS_SSDP_ST,
      },
    ],
  };

  const televisions = await discoverWebOsTelevisions(fakeGladys, {
    fetchImpl: async () => ({
      ok: false,
    }),
  });

  assert.deepEqual(televisions, [
    {
      ip: '192.168.1.73',
      udn: 'uuid:ghi-789',
      name: 'LG webOS TV (192.168.1.73)',
      model: '',
      serial: '',
      location: 'http://192.168.1.73/device.xml',
    },
  ]);
});

test('ignores unrelated object headers when requested SSDP headers are missing', async () => {
  const fakeGladys = {
    scanNetwork: async () => [
      {
        source_ip: '192.168.1.74',
        headers: {
          server: 'webOS/1.0 UPnP/1.0',
          cacheControl: 'max-age=1800',
        },
      },
    ],
  };

  const televisions = await discoverWebOsTelevisions(fakeGladys, {
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  assert.deepEqual(televisions, []);
});

test('covers remaining television device construction branches', () => {
  assert.equal(buildTelevisionDevice(gladys, { tv_name: 'TV' }), null);

  const macOnlyDevice = buildTelevisionDevice(gladys, {
    tv_name: 'TV MAC',
    tv_mac: 'AA:BB:CC:DD:EE:FF',
  });

  assert.equal(macOnlyDevice.external_id, 'ext:test:lg-webos:aabbccddeeff');

  const stableIdDevice = buildTelevisionDevice(
    gladys,
    {
      tv_name: 'TV stable',
      tv_mac: 'AA:BB:CC:DD:EE:FF',
      tv_udn: 'uuid:ignored',
      tv_platform_id: 'ignored-platform',
    },
    {
      stableId: 'uuid:FORCED-ID',
    },
  );

  assert.equal(stableIdDevice.external_id, 'ext:test:lg-webos:forced-id');

  assert.deepEqual(paramsToObject(), {});
  assert.deepEqual(paramsToObject({}), {});
});

test('covers remaining discovered television branches', () => {
  const device = buildDiscoveredTelevisionDevice(
    gladys,
    {
      ip: '192.168.1.50',
      udn: 'uuid:OTHER-TV',
      name: 'Other TV',
      model: '',
      serial: '',
      location: 'http://192.168.1.50/device.xml',
    },
    {
      tv_ip: '192.168.1.40',
      tv_udn: 'uuid:CONFIGURED-TV',
      tv_mac: 'AA:BB:CC:DD:EE:FF',
      tv_platform_id: 'configured-platform',
    },
  );

  assert.equal(device.external_id, 'ext:test:lg-webos:other-tv');

  assert.deepEqual(paramsToObject(device), {
    ip: '192.168.1.50',
    udn: 'uuid:OTHER-TV',
    platform_id: 'uuid:OTHER-TV',
    location: 'http://192.168.1.50/device.xml',
  });
});

test('covers remaining writable value normalization branches', async () => {
  const fakeGladys = createFakeGladys();
  const requests = [];

  const client = {
    request: async (uri, payload) => {
      requests.push({ uri, payload });
      return { returnValue: true };
    },
  };

  const feature = (key) => ({
    external_id: `lg-webos:test:${key}`,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config: {},
    feature: feature(FEATURE_KEYS.MUTE),
    value: 0,
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config: {},
    feature: feature(FEATURE_KEYS.TOAST),
    value: 'Message direct',
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config: {},
    feature: feature(FEATURE_KEYS.SOURCE),
    value: '  HDMI_1  ',
  });

  await setTelevisionValue({
    gladys: fakeGladys,
    client,
    config: {},
    feature: feature(FEATURE_KEYS.LAUNCH_APP),
    value: '  youtube.leanback.v4  ',
  });

  assert.deepEqual(requests, [
    {
      uri: WEBOS_COMMANDS.SET_MUTE,
      payload: { mute: false },
    },
    {
      uri: WEBOS_COMMANDS.CREATE_TOAST,
      payload: { message: 'Message direct' },
    },
    {
      uri: WEBOS_COMMANDS.SWITCH_INPUT,
      payload: { inputId: 'HDMI_1' },
    },
    {
      uri: WEBOS_COMMANDS.LAUNCH_APP,
      payload: { id: 'youtube.leanback.v4' },
    },
  ]);

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.TOAST),
      value: null,
    }),
    /Toast message cannot be empty/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.SOURCE),
      value: null,
    }),
    /Input id cannot be empty/,
  );

  await assert.rejects(
    setTelevisionValue({
      gladys: fakeGladys,
      client,
      config: {},
      feature: feature(FEATURE_KEYS.LAUNCH_APP),
      value: null,
    }),
    /Application id cannot be empty/,
  );
});

test('returns empty normalized lists when webOS omits apps or devices', async () => {
  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return {};
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return {};
      }

      throw new Error(`Unexpected URI ${uri}`);
    },
  };

  assert.deepEqual(await getInstalledApplications(client), []);

  assert.deepEqual(await getExternalInputs(client), []);
});

test('subscription reports screen-off as on and covers foreground app fallbacks', async () => {
  const fakeGladys = createFakeGladys();
  const callbacks = new Map();

  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return {
          apps: [
            {
              id: 'netflix',
              title: 'Netflix',
              visible: true,
            },
          ],
        };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return {
          devices: [
            {
              id: 'HDMI_3',
              appId: 'com.webos.app.hdmi3',
              label: 'Playstation 5',
              connected: false,
            },
          ],
        };
      }

      throw new Error(`Unexpected request ${uri}`);
    },

    subscribe: async (uri, callback) => {
      callbacks.set(uri, callback);
      return () => {};
    },
  };

  await startTelevisionSubscriptions(fakeGladys, client, {
    tv_name: 'TV',
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:test',
  });

  await callbacks.get(WEBOS_COMMANDS.GET_POWER_STATE)({
    state: 'Screen Off',
  });

  assert.equal(fakeGladys.published.at(-1).state, 1);

  await callbacks.get(WEBOS_COMMANDS.FOREGROUND_APP)({
    appId: 'netflix',
  });

  assert.equal(fakeGladys.published.at(-1).text, 'Netflix');

  await callbacks.get(WEBOS_COMMANDS.FOREGROUND_APP)({
    id: 'com.webos.app.hdmi3',
  });

  assert.ok(
    fakeGladys.published.some((item) => item.text === 'Playstation 5 (HDMI_3) — disconnected'),
  );

  await callbacks.get(WEBOS_COMMANDS.FOREGROUND_APP)({
    appId: 'unknown.app',
  });

  assert.equal(fakeGladys.published.at(-1).text, 'unknown.app');

  const count = fakeGladys.published.length;

  await callbacks.get(WEBOS_COMMANDS.FOREGROUND_APP)({});

  assert.equal(fakeGladys.published.length, count);
});

test('volume subscription covers partial and empty payloads', async () => {
  const fakeGladys = createFakeGladys();
  const callbacks = new Map();

  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return { apps: [] };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return { devices: [] };
      }

      throw new Error(`Unexpected request ${uri}`);
    },

    subscribe: async (uri, callback) => {
      callbacks.set(uri, callback);
      return () => {};
    },
  };

  await startTelevisionSubscriptions(fakeGladys, client, {
    tv_name: 'TV',
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:test',
  });

  await callbacks.get(WEBOS_COMMANDS.GET_VOLUME)({
    volume: '27',
  });

  assert.equal(fakeGladys.published.at(-1).state, 27);

  await callbacks.get(WEBOS_COMMANDS.GET_VOLUME)({
    muted: false,
  });

  assert.equal(fakeGladys.published.at(-1).state, 0);

  const count = fakeGladys.published.length;

  await callbacks.get(WEBOS_COMMANDS.GET_VOLUME)({});

  assert.equal(fakeGladys.published.length, count);
});

test('startTelevisionSubscriptions returns a noop cleanup without a stable TV id', async () => {
  const fakeGladys = createFakeGladys();

  let subscribed = false;

  const cleanup = await startTelevisionSubscriptions(
    fakeGladys,
    {
      request: async () => ({}),

      subscribe: async () => {
        subscribed = true;
      },
    },
    {
      tv_name: 'TV',
    },
  );

  assert.equal(typeof cleanup, 'function');
  assert.equal(subscribed, false);
  assert.doesNotThrow(() => cleanup());
});

test('cleanup tolerates undefined subscription cleanup functions', async () => {
  const fakeGladys = createFakeGladys();

  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return { apps: [] };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return { devices: [] };
      }

      throw new Error(`Unexpected request ${uri}`);
    },

    subscribe: async () => undefined,
  };

  const cleanup = await startTelevisionSubscriptions(fakeGladys, client, {
    tv_name: 'TV',
    tv_udn: 'uuid:test',
  });

  assert.doesNotThrow(() => cleanup());
});

test('publishes explicit power off state', async () => {
  const fakeGladys = createFakeGladys();

  await publishPowerState(
    fakeGladys,
    {
      tv_udn: 'uuid:test',
      tv_name: 'TV',
    },
    0,
  );

  assert.equal(fakeGladys.published.at(-1).state, 0);
});

test('subscription supports an external input without an appId', async () => {
  const fakeGladys = createFakeGladys();
  const callbacks = new Map();

  const client = {
    request: async (uri) => {
      if (uri === WEBOS_COMMANDS.LIST_APPS) {
        return { apps: [] };
      }

      if (uri === WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST) {
        return {
          devices: [
            {
              id: 'HDMI_1',
              label: 'HDMI 1',
              connected: true,
            },
          ],
        };
      }

      throw new Error(`Unexpected request ${uri}`);
    },

    subscribe: async (uri, callback) => {
      callbacks.set(uri, callback);
      return () => {};
    },
  };

  await startTelevisionSubscriptions(fakeGladys, client, {
    tv_name: 'TV',
    tv_ip: '192.168.1.71',
    tv_udn: 'uuid:test',
  });

  assert.equal(callbacks.size, 3);
});
