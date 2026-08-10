import { WEBOS_COMMANDS } from '../webos/commands.js';
import { wakeOnLan } from '../wol.js';
import { logger } from '@gladysassistant/integration-sdk';

export const FEATURE_KEYS = Object.freeze({
  POWER: 'binary',
  VOLUME: 'volume',
  MUTE: 'volume-mute',
  VOLUME_UP: 'volume-up',
  VOLUME_DOWN: 'volume-down',
  PLAY: 'play',
  PAUSE: 'pause',
  STOP: 'stop',
  CHANNEL_UP: 'channel-up',
  CHANNEL_DOWN: 'channel-down',
  TOAST: 'toast',
  SOURCE: 'source',
  CURRENT_APP: 'current-app',
  LAUNCH_APP: 'launch-app',
  INPUT_STATUS: 'input-status',
});

const textFeature = (ids, key, name, { readOnly = true, feedback = true } = {}) => ({
  name,
  external_id: ids.feature(key),
  category: 'text',
  type: 'text',
  min: 0,
  max: 0,
  read_only: readOnly,
  has_feedback: feedback,
  keep_history: feedback,
});

const pushButton = (ids, key, name) => ({
  name,
  external_id: ids.feature(key),
  category: 'television',
  type: key,
  min: 0,
  max: 1,
  read_only: false,
  has_feedback: false,
  keep_history: false,
});

function stablePlatformId(value) {
  return String(value)
    .toLowerCase()
    .replace(/^uuid:/, '')
    .replace(/[^a-z0-9_-]/g, '');
}

export function buildTelevisionDevice(gladys, config, { stableId } = {}) {
  const hardwareId = stableId || config.tv_platform_id || config.tv_udn || config.tv_mac;
  if (!hardwareId) return null;
  const ids = gladys.externalIds('lg-webos', stablePlatformId(hardwareId));
  const params = [
    { name: 'ip', value: config.tv_ip },
    { name: 'mac', value: config.tv_mac },
    { name: 'udn', value: config.tv_udn },
    { name: 'platform_id', value: hardwareId },
  ].filter((param) => param.value);

  return {
    name: config.tv_name,
    external_id: ids.device,
    params,
    features: [
      {
        name: 'Power',
        external_id: ids.feature(FEATURE_KEYS.POWER),
        category: 'television',
        type: 'binary',
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      {
        name: 'Volume',
        external_id: ids.feature(FEATURE_KEYS.VOLUME),
        category: 'television',
        type: 'volume',
        min: 0,
        max: 100,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      {
        name: 'Mute',
        external_id: ids.feature(FEATURE_KEYS.MUTE),
        category: 'television',
        type: 'volume-mute',
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      pushButton(ids, FEATURE_KEYS.VOLUME_UP, 'Volume +'),
      pushButton(ids, FEATURE_KEYS.VOLUME_DOWN, 'Volume -'),
      pushButton(ids, FEATURE_KEYS.PLAY, 'Play'),
      pushButton(ids, FEATURE_KEYS.PAUSE, 'Pause'),
      pushButton(ids, FEATURE_KEYS.STOP, 'Stop'),
      pushButton(ids, FEATURE_KEYS.CHANNEL_UP, 'Channel +'),
      pushButton(ids, FEATURE_KEYS.CHANNEL_DOWN, 'Channel -'),
      textFeature(ids, FEATURE_KEYS.TOAST, 'Message TV', { readOnly: false }),
      textFeature(ids, FEATURE_KEYS.SOURCE, 'Source', { readOnly: false }),
      textFeature(ids, FEATURE_KEYS.CURRENT_APP, 'Application courante'),
      textFeature(ids, FEATURE_KEYS.LAUNCH_APP, 'Lancer une application', {
        readOnly: false,
        feedback: false,
      }),
      textFeature(ids, FEATURE_KEYS.INPUT_STATUS, 'État de la source'),
    ],
  };
}

export function buildDiscoveredTelevisionDevice(gladys, television, config = {}) {
  const sameConfiguredTv = config.tv_udn === television.udn || config.tv_ip === television.ip;
  const stableId = sameConfiguredTv
    ? config.tv_platform_id || config.tv_mac || television.udn
    : television.udn;
  const device = buildTelevisionDevice(
    gladys,
    {
      ...config,
      tv_ip: television.ip,
      tv_name: television.name,
      tv_udn: television.udn,
      tv_mac: sameConfiguredTv ? config.tv_mac : '',
    },
    { stableId },
  );
  if (television.model) device.model = television.model;
  device.params.push({ name: 'location', value: television.location });
  if (television.serial) device.params.push({ name: 'serial', value: television.serial });
  return device;
}

export function paramsToObject(device) {
  return Object.fromEntries((device?.params || []).map(({ name, value }) => [name, value]));
}

export async function setTelevisionValue({ client, config, feature, value }) {
  const key = feature.external_id.split(':').at(-1);
  switch (key) {
    case FEATURE_KEYS.POWER:
      logger.info(`LG webOS Power received value=${value}`);
      if (Number(value) === 1) {
        logger.info('LG webOS Power => ON');
        if (!config.tv_mac) {
          throw new Error(
            'Wake-on-LAN requires the TV MAC address. Add it in the integration configuration.',
          );
        }
        return wakeOnLan(config.tv_mac, config.tv_ip);
      } else {
        logger.info('LG webOS Power => OFF');
      }
      return client.request(WEBOS_COMMANDS.TURN_OFF);
    case FEATURE_KEYS.VOLUME:
      return client.request(WEBOS_COMMANDS.SET_VOLUME, { volume: Math.round(Number(value)) });
    case FEATURE_KEYS.MUTE:
      return client.request(WEBOS_COMMANDS.SET_MUTE, { mute: Boolean(Number(value)) });
    case FEATURE_KEYS.VOLUME_UP:
      return client.request(WEBOS_COMMANDS.VOLUME_UP);
    case FEATURE_KEYS.VOLUME_DOWN:
      return client.request(WEBOS_COMMANDS.VOLUME_DOWN);
    case FEATURE_KEYS.PLAY:
      return client.request(WEBOS_COMMANDS.PLAY);
    case FEATURE_KEYS.PAUSE:
      return client.request(WEBOS_COMMANDS.PAUSE);
    case FEATURE_KEYS.STOP:
      return client.request(WEBOS_COMMANDS.STOP);
    case FEATURE_KEYS.CHANNEL_UP:
      return client.request(WEBOS_COMMANDS.CHANNEL_UP);
    case FEATURE_KEYS.CHANNEL_DOWN:
      return client.request(WEBOS_COMMANDS.CHANNEL_DOWN);
    case FEATURE_KEYS.TOAST: {
      const message = typeof value === 'object' && value?.text !== undefined ? value.text : value;
      if (!String(message ?? '').trim()) throw new Error('Toast message cannot be empty.');
      return client.request(WEBOS_COMMANDS.CREATE_TOAST, { message: String(message) });
    }
    case FEATURE_KEYS.SOURCE: {
      const inputId = String(value ?? '').trim();
      if (!inputId) throw new Error('Input id cannot be empty.');
      logger.info(`LG webOS switching input to ${inputId}`);
      return client.request(WEBOS_COMMANDS.SWITCH_INPUT, { inputId });
    }
    case FEATURE_KEYS.LAUNCH_APP: {
      const appId = String(value ?? '').trim();
      if (!appId) throw new Error('Application id cannot be empty.');
      logger.info(`LG webOS launching application ${appId}`);
      return client.request(WEBOS_COMMANDS.LAUNCH_APP, { id: appId });
    }
    default:
      throw new Error(`Unsupported LG webOS feature: ${key}`);
  }
}


export async function getInstalledApplications(client) {
  const payload = await client.request(WEBOS_COMMANDS.LIST_APPS);
  return (payload.apps || [])
    .filter((app) => app?.id)
    .map((app) => ({
      id: String(app.id),
      title: String(app.title || app.id),
      type: String(app.type || ''),
      visible: app.visible !== false,
    }));
}

export async function getExternalInputs(client) {
  const payload = await client.request(WEBOS_COMMANDS.GET_EXTERNAL_INPUT_LIST);
  return (payload.devices || [])
    .filter((input) => input?.id)
    .map((input) => ({
      id: String(input.id),
      appId: String(input.appId || ''),
      label: String(input.label || input.id),
      icon: String(input.icon || ''),
      connected: input.connected !== false,
    }));
}

export async function startTelevisionSubscriptions(gladys, client, config) {
  const device = buildTelevisionDevice(gladys, config);
  if (!device) return () => {};
  const byType = new Map(device.features.map((feature) => [feature.type, feature]));
  const byKey = new Map(
    device.features.map((feature) => [feature.external_id.split(':').at(-1), feature]),
  );
  const cleanups = [];

  let applications = [];
  let inputs = [];

  try {
    applications = await getInstalledApplications(client);
    logger.info(
      `LG webOS installed applications: ${applications
        .map((app) => `${app.title} (${app.id})`)
        .join(', ')}`,
    );
  } catch (error) {
    logger.warn('Unable to retrieve LG webOS installed applications', error);
  }

  try {
    inputs = await getExternalInputs(client);
    logger.info(
      `LG webOS external inputs: ${inputs
        .map(
          (input) =>
            `${input.label} (${input.id}${input.appId ? ` / ${input.appId}` : ''}) connected=${input.connected}`,
        )
        .join(', ')}`,
    );
  } catch (error) {
    logger.warn('Unable to retrieve LG webOS external inputs', error);
  }

  cleanups.push(
    await client.subscribe(WEBOS_COMMANDS.GET_POWER_STATE, async (payload) => {
      logger.info(`LG webOS real power state: ${JSON.stringify(payload)}`);

      const state = String(payload.state || '').toLowerCase();

      const isOn = state === 'active' || state === 'screen off';

      await gladys.publishState(
        byType.get(FEATURE_KEYS.POWER).external_id,

        isOn ? 1 : 0,
      );
    }),
  );

  cleanups.push(
    await client.subscribe(WEBOS_COMMANDS.FOREGROUND_APP, async (payload) => {
      const appId = String(payload.appId || payload.id || '');
      const application = applications.find((app) => app.id === appId);
      const input = inputs.find((candidate) => candidate.appId === appId);

      const title = application?.title || input?.label || appId || 'unknown';

      logger.info(
        `LG webOS foreground application: appId=${appId || 'unknown'}, title=${title}, input=${
          input?.id || 'none'
        }, payload=${JSON.stringify(payload)}`,
      );

      const states = [];

      if (appId) {
        states.push({
          device_feature_external_id: byKey.get(FEATURE_KEYS.CURRENT_APP).external_id,
          text: title,
        });
      }

      if (input) {
        states.push(
          {
            device_feature_external_id: byKey.get(FEATURE_KEYS.SOURCE).external_id,
            text: input.id,
          },
          {
            device_feature_external_id: byKey.get(FEATURE_KEYS.INPUT_STATUS).external_id,
            text: `${input.label} (${input.id}) — ${
              input.connected ? 'connected' : 'disconnected'
            }`,
          },
        );
      }

      if (states.length) {
        await gladys.publishStates(states);
      }
    }),
  );

  cleanups.push(
    await client.subscribe(WEBOS_COMMANDS.GET_VOLUME, async (payload) => {
      const states = [];

      if (payload.volume !== undefined) {
        states.push({
          device_feature_external_id: byType.get('volume').external_id,

          state: Number(payload.volume),
        });
      }

      if (payload.muted !== undefined) {
        states.push({
          device_feature_external_id: byType.get('volume-mute').external_id,

          state: payload.muted ? 1 : 0,
        });
      }

      if (states.length) {
        await gladys.publishStates(states);
      }
    }),
  );

  return () => cleanups.forEach((cleanup) => cleanup?.());
}

export async function publishPowerState(gladys, config, value) {
  const device = buildTelevisionDevice(gladys, config);
  if (!device) return;

  const powerFeature = device.features.find((feature) => feature.type === FEATURE_KEYS.POWER);

  if (!powerFeature) return;

  await gladys.publishState(powerFeature.external_id, value ? 1 : 0);
}
