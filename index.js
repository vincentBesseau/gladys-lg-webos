import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, validateConfig } from './src/config.js';
import {
  FEATURE_KEYS,
  buildDiscoveredTelevisionDevice,
  buildTelevisionDevice,
  paramsToObject,
  publishPowerState,
  setTelevisionValue,
  startTelevisionSubscriptions,
} from './src/devices/television.js';
import { discoverWebOsTelevisions } from './src/discovery/ssdp.js';
import { WebOsClient } from './src/webos/client.js';
import { WEBOS_COMMANDS } from './src/webos/commands.js';

const gladys = new GladysIntegration();
let config = normalizeConfig();
let client = null;
let stopSubscriptions = () => {};
let wakingUp = false;

async function publishConfiguredDevice() {
  const device = buildTelevisionDevice(gladys, config);
  await gladys.publishDiscoveredDevices(device ? [device] : []);
}

async function scanTelevisions() {
  const televisions = await discoverWebOsTelevisions(gladys);
  logger.info(`LG webOS discovery found ${televisions.length} TV(s).`);

  const devices = televisions.map((television) =>
    buildDiscoveredTelevisionDevice(gladys, television, config),
  );

  await gladys.publishDiscoveredDevices(devices);

  if (config.tv_udn) {
    const current = televisions.find((television) => television.udn === config.tv_udn);

    if (current && current.ip !== config.tv_ip) {
      config = normalizeConfig({
        ...config,
        tv_ip: current.ip,
        tv_name: current.name,
      });

      await gladys.setConfig({
        tv_ip: current.ip,
        tv_name: current.name,
      });

      logger.info(`Updated LG webOS TV IP from SSDP discovery: ${current.ip}`);
    }
  }
}

async function disconnectTv() {
  logger.info(
    `LG webOS power debug: disconnectTv called, hasClient=${Boolean(client)}, wakingUp=${wakingUp}`,
  );

  if (!wakingUp) {
    await publishPowerState(gladys, config, 0).catch(() => {});
  }

  stopSubscriptions();
  stopSubscriptions = () => {};

  client?.close();
  client = null;
}

async function connectTv() {
  await disconnectTv();
  validateConfig(config);

  if (config.connection_mode !== 'ws') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const nextClient = new WebOsClient({
    ip: config.tv_ip,
    clientKey: config.client_key,
    mode: config.connection_mode,
  });

  nextClient.on('pairing', () => {
    logger.info('LG webOS pairing requested: accept the authorization prompt on the TV.');

    gladys
      .setConnectionStatus(false, {
        en: 'Accept the pairing request displayed on the TV.',
        fr: "Acceptez la demande d'association affichée sur la TV.",
      })
      .catch(() => {});
  });

  nextClient.on('registered', async (clientKey) => {
    if (clientKey && clientKey !== config.client_key) {
      config = {
        ...config,
        client_key: clientKey,
      };

      await gladys.setConfig({
        client_key: clientKey,
      });
    }
  });

  nextClient.on('error', (error) => {
    logger.warn('LG webOS protocol error', error);
  });

  nextClient.on('close', () => {
    logger.info('LG webOS connection closed: publishing Power OFF.');

    logger.info(
      `LG webOS power debug: socket close, clientIsNext=${
        client === nextClient
      }, wakingUp=${wakingUp}`,
    );

    if (client === nextClient) {
      client = null;
    }

    if (!wakingUp) {
      publishPowerState(gladys, config, 0).catch((error) => {
        logger.warn('Unable to publish LG webOS Power OFF state', error);
      });

      gladys
        .setConnectionStatus(false, {
          en: 'The TV is offline or unreachable.',
          fr: 'La TV est éteinte ou injoignable.',
        })
        .catch(() => {});
    }
  });

  await nextClient.connect();

  client = nextClient;

  stopSubscriptions = await startTelevisionSubscriptions(gladys, client, config);

  await gladys.setConnectionStatus(true);

  logger.info(`LG webOS connected through ${client.connectedUrl}`);
}

async function reconnectTvAfterWake() {
  const maxAttempts = 15;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.info(`LG webOS reconnect attempt ${attempt}/${maxAttempts} after Wake-on-LAN`);

      logger.info(
        `LG webOS power debug: reconnect attempt ${attempt}, clientBefore=${Boolean(
          client,
        )}, wakingUp=${wakingUp}`,
      );

      await connectTv();

      wakingUp = false;

      logger.info('LG webOS power debug: WebSocket reconnected, setting wakingUp=false');

      await publishPowerState(gladys, config, 1).catch(() => {});

      logger.info('LG webOS reconnected after Wake-on-LAN');

      return;
    } catch (error) {
      logger.info(
        `LG webOS power debug: reconnect attempt ${attempt} failed, clientNow=${Boolean(
          client,
        )}, wakingUp=${wakingUp}`,
      );

      logger.debug(
        `LG webOS reconnect attempt ${attempt}/${maxAttempts} failed after Wake-on-LAN`,
        error,
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  wakingUp = false;

  await publishPowerState(gladys, config, 0).catch(() => {});

  logger.warn('LG webOS did not reconnect within 30 seconds after Wake-on-LAN');
}

async function adoptDiscoveredDevice(device) {
  const params = paramsToObject(device);

  if (!params.ip || !params.udn) {
    return;
  }

  config = normalizeConfig({
    ...config,
    tv_ip: params.ip,
    tv_udn: params.udn,
    tv_name: device.name || config.tv_name,
    tv_mac: params.mac || config.tv_mac,
    tv_platform_id: params.platform_id || config.tv_platform_id || params.udn,
  });

  await gladys.setConfig({
    tv_ip: config.tv_ip,
    tv_udn: config.tv_udn,
    tv_name: config.tv_name,
    tv_platform_id: config.tv_platform_id,
    ...(config.tv_mac
      ? {
          tv_mac: config.tv_mac,
        }
      : {}),
  });

  try {
    await connectTv();
  } catch (error) {
    logger.warn('Discovered LG webOS TV was added but is not reachable for pairing yet', error);

    await gladys.setConnectionStatus(false, {
      en: 'TV added. Turn it on and accept the pairing prompt, then test the connection.',
      fr: "TV ajoutée. Allumez-la et acceptez la demande d'association, puis testez la connexion.",
    });
  }
}

gladys.onScanRequest(scanTelevisions);
gladys.onDeviceCreated(adoptDiscoveredDevice);

gladys.onSetValue(async (device, feature, value) => {
  logger.info(
    `LG webOS onSetValue: feature=${feature.external_id}, value=${JSON.stringify(
      value,
    )}, clientConnected=${Boolean(client)}`,
  );

  logger.info(
    `LG webOS power debug: featureKey=${feature.external_id
      .split(':')
      .at(-1)}, rawValue=${JSON.stringify(value)}, numericValue=${Number(
      value,
    )}, hasClient=${Boolean(client)}, wakingUp=${wakingUp}`,
  );

  if (!client && feature.external_id.endsWith(`:${FEATURE_KEYS.POWER}`) && Number(value) === 1) {
    logger.info('LG webOS power debug: entering OFF -> ON Wake-on-LAN branch');

    wakingUp = true;

    logger.info('LG webOS Power command interpreted as ON -> Wake-on-LAN');

    try {
      await setTelevisionValue({
        gladys,
        client: null,
        config,
        feature,
        value,
      });

      await publishPowerState(gladys, config, 1).catch(() => {});

      logger.info('LG webOS power debug: optimistic Power=1 published after Wake-on-LAN');
    } catch (error) {
      wakingUp = false;

      logger.warn('Unable to set LG webOS Power ON', error);

      throw error;
    }

    reconnectTvAfterWake().catch((error) => {
      logger.warn('Unable to reconnect LG webOS after Wake-on-LAN', error);
    });

    return;
  }

  if (!client) {
    throw new Error('LG webOS TV is not connected.');
  }

  await setTelevisionValue({
    gladys,
    client,
    config,
    feature,
    value,
  });
});

gladys.onAction('test_connection', async () => {
  await connectTv();

  return {
    en: `Connected to ${config.tv_name}.`,
    fr: `Connexion à ${config.tv_name} réussie.`,
  };
});

gladys.onAction('test_toast', async (fields) => {
  if (!client) {
    await connectTv();
  }

  await client.request(WEBOS_COMMANDS.CREATE_TOAST, {
    message: fields.message || 'Hello from Gladys Assistant!',
  });

  return {
    en: 'Toast sent to the TV.',
    fr: 'Notification envoyée sur la TV.',
  };
});

gladys.onConfigUpdated(async (newConfig) => {
  config = normalizeConfig(newConfig);

  await publishConfiguredDevice();

  if (!config.tv_ip) {
    await disconnectTv();

    await gladys.setConnectionStatus(false, {
      en: 'Run a network scan or configure the TV IP address.',
      fr: "Lancez une découverte réseau ou configurez l'adresse IP de la TV.",
    });

    return;
  }

  try {
    await connectTv();
  } catch (error) {
    logger.warn('Unable to connect to LG webOS after configuration update', error);

    await gladys.setConnectionStatus(false, {
      en: 'Unable to connect to the TV. Check its IP and network settings.',
      fr: 'Impossible de se connecter à la TV. Vérifiez son IP et ses réglages réseau.',
    });
  }
});

gladys.on('connected', async () => {
  config = normalizeConfig(await gladys.getConfig());

  await publishConfiguredDevice();

  if (!config.tv_ip) {
    await gladys.setConnectionStatus(false, {
      en: 'Run a network scan to discover your LG webOS TV, or configure it manually.',
      fr: 'Lancez une découverte réseau pour trouver votre TV LG webOS, ou configurez-la manuellement.',
    });

    return;
  }

  try {
    await connectTv();
  } catch (error) {
    logger.warn('LG webOS TV is currently unreachable', error);

    await gladys.setConnectionStatus(false, {
      en: 'TV unreachable. Turn it on to pair or connect.',
      fr: "TV injoignable. Allumez-la pour l'associer ou vous connecter.",
    });
  }
});

gladys.handleShutdown(async () => {
  await disconnectTv();
});

logger.info('Starting LG webOS integration...');

gladys.connect().catch((error) => {
  logger.error('Initial connection to Gladys failed', error);

  process.exit(1);
});
