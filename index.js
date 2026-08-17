import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, normalizeTelevisionsConfig, validateConfig } from './src/config.js';
import {
  FEATURE_KEYS,
  buildDiscoveredTelevisionDevice,
  buildTelevisionDevice,
  publishPowerState,
  setTelevisionValue,
  startTelevisionSubscriptions,
} from './src/devices/television.js';
import { discoverWebOsTelevisions } from './src/discovery/ssdp.js';
import {
  createTelevisionRuntime,
  createTelevisionRuntimeRegistry,
} from './src/runtime/televisions.js';
import { WebOsClient } from './src/webos/client.js';

const gladys = new GladysIntegration();

const defaultRuntime = createTelevisionRuntime();

const runtimeRegistry = createTelevisionRuntimeRegistry(gladys, defaultRuntime);

const {
  registerRuntime,
  getRuntimeForDevice,
  getOrCreateRuntimeForDevice,
  getRuntimeId,
  getUniqueRuntimes,
  findRuntimeForTelevision,
  findRuntimeById,
  clearRuntimes,
} = runtimeRegistry;

async function updateConnectionStatus() {
  const televisionRuntimes = getUniqueRuntimes();

  if (!televisionRuntimes.length) {
    await gladys.setConnectionStatus(false, {
      en: 'No LG webOS TV is currently configured.',
      fr: "Aucune TV LG webOS n'est actuellement configurée.",
      de: 'Derzeit ist kein LG webOS Fernseher konfiguriert.',
    });

    return;
  }

  const connectedCount = televisionRuntimes.filter((runtime) => runtime.client).length;

  if (connectedCount > 0) {
    await gladys.setConnectionStatus(true);

    logger.info(`LG webOS connected to ${connectedCount}/${televisionRuntimes.length} TV(s).`);

    return;
  }

  await gladys.setConnectionStatus(false, {
    en: 'All configured LG webOS TVs are currently unreachable.',
    fr: 'Toutes les TV LG webOS configurées sont actuellement injoignables.',
    de: 'Alle konfigurierten LG webOS Fernseher sind derzeit nicht erreichbar.',
  });
}

async function persistRuntime(runtime) {
  const id = getRuntimeId(runtime);

  if (!id) {
    throw new Error('Unable to persist LG webOS TV without a stable identifier.');
  }

  const savedConfig = await gladys.getConfig();

  await gladys.setConfig({
    ...savedConfig,
    televisions: {
      ...(savedConfig.televisions || {}),
      [id]: runtime.config,
    },
  });
}

async function publishConfiguredDevice(runtime) {
  const device = buildTelevisionDevice(gladys, runtime.config);

  if (device) {
    registerRuntime(runtime);
  }

  await gladys.publishDiscoveredDevices(device ? [device] : []);
}

async function scanTelevisions() {
  const televisions = await discoverWebOsTelevisions(gladys);

  logger.info(`LG webOS discovery found ${televisions.length} TV(s).`);

  const devices = televisions.map((television) => {
    const runtime = findRuntimeForTelevision(television);

    return buildDiscoveredTelevisionDevice(gladys, television, runtime?.config || {});
  });

  await gladys.publishDiscoveredDevices(devices);

  for (const television of televisions) {
    const runtime = findRuntimeForTelevision(television);

    if (!runtime) {
      continue;
    }

    const ipChanged = television.ip && television.ip !== runtime.config.tv_ip;

    const nameChanged = television.name && television.name !== runtime.config.tv_name;

    if (!ipChanged && !nameChanged) {
      continue;
    }

    runtime.config = normalizeConfig({
      ...runtime.config,
      ...(ipChanged
        ? {
            tv_ip: television.ip,
          }
        : {}),
      ...(nameChanged
        ? {
            tv_name: television.name,
          }
        : {}),
    });

    registerRuntime(runtime);

    await persistRuntime(runtime);

    logger.info(
      `Updated LG webOS TV from SSDP discovery: ${
        runtime.config.tv_name || runtime.config.tv_udn
      } (${runtime.config.tv_ip})`,
    );
  }
}

async function disconnectTv(runtime) {

  if (!runtime.wakingUp) {
    await publishPowerState(gladys, runtime.config, 0).catch(() => {});
  }

  runtime.stopSubscriptions();
  runtime.stopSubscriptions = () => {};

  runtime.intentionalDisconnect = true;

  runtime.client?.close();
  runtime.client = null;

  await updateConnectionStatus().catch(() => {});
}

async function connectTv(runtime, { timeout = 15000 } = {}) {
  await disconnectTv(runtime);

  runtime.intentionalDisconnect = false;

  validateConfig(runtime.config);

  if (runtime.config.connection_mode !== 'ws') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const nextClient = new WebOsClient({
    ip: runtime.config.tv_ip,
    clientKey: runtime.config.client_key,
    mode: runtime.config.connection_mode,
    timeout,
  });

  nextClient.on('pairing', () => {
    logger.info('LG webOS pairing requested: accept the authorization prompt on the TV.');

    gladys
      .setConnectionStatus(false, {
        en: 'Accept the pairing request displayed on the TV.',
        fr: "Acceptez la demande d'association affichée sur la TV.",
        de: 'Bestätigen Sie die auf dem Fernseher angezeigte Kopplungsanfrage.',
      })
      .catch(() => {});
  });

  nextClient.on('registered', async (clientKey) => {
    if (clientKey && clientKey !== runtime.config.client_key) {
      runtime.config = {
        ...runtime.config,
        client_key: clientKey,
      };

      await persistRuntime(runtime);

      logger.info(
        `LG webOS client key persisted for ${runtime.config.tv_name || runtime.config.tv_ip}`,
      );
    }
  });

  nextClient.on('error', (error) => {
    logger.warn('LG webOS protocol error', error);
  });

  nextClient.on('close', () => {
    logger.info('LG webOS connection closed: publishing Power OFF.');

    const intentionalDisconnect = runtime.intentionalDisconnect;

    runtime.intentionalDisconnect = false;

    if (runtime.client === nextClient) {
      runtime.client = null;
    }

    if (!runtime.wakingUp) {
      publishPowerState(gladys, runtime.config, 0).catch((error) => {
        logger.warn('Unable to publish LG webOS Power OFF state', error);
      });
    }

    updateConnectionStatus().catch((error) => {
      logger.warn('Unable to update LG webOS connection status', error);
    });

    if (!intentionalDisconnect && !runtime.wakingUp) {
      reconnectTvAfterUnexpectedClose(runtime).catch((error) => {
        logger.warn('Unable to automatically reconnect LG webOS TV', error);
      });
    }
  });

  await nextClient.connect();

  runtime.client = nextClient;

  runtime.stopSubscriptions = await startTelevisionSubscriptions(
    gladys,
    runtime.client,
    runtime.config,
  );

  await updateConnectionStatus();

  logger.info(`LG webOS connected through ${runtime.client.connectedUrl}`);
}

async function reconnectTvAfterWake(runtime) {
  const maxAttempts = 15;
  const initialDelay = 5000;
  const retryDelay = 2000;

  logger.info(`LG webOS waiting ${initialDelay / 1000}s before reconnecting after Wake-on-LAN`);

  await new Promise((resolve) => setTimeout(resolve, initialDelay));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.info(`LG webOS reconnect attempt ${attempt}/${maxAttempts} after Wake-on-LAN`);

      await connectTv(runtime);

      runtime.wakingUp = false;

      await publishPowerState(gladys, runtime.config, 1).catch(() => {});

      logger.info('LG webOS reconnected after Wake-on-LAN');

      return;
    } catch (error) {
      logger.info(
        `LG webOS power debug: reconnect attempt ${attempt} failed, clientNow=${Boolean(
          runtime.client,
        )}, wakingUp=${runtime.wakingUp}`,
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

  runtime.wakingUp = false;

  await publishPowerState(gladys, runtime.config, 0).catch(() => {});

  await updateConnectionStatus().catch(() => {});

  logger.warn(`LG webOS did not reconnect after Wake-on-LAN (${maxAttempts} attempts)`);
}

async function reconnectTvAfterUnexpectedClose(runtime) {
  if (runtime.wakingUp || runtime.reconnecting) {
    return;
  }

  runtime.reconnecting = true;

  const maxAttempts = 10;
  const initialDelay = 3000;
  const retryDelay = 5000;

  logger.info(
    `LG webOS unexpected disconnect detected for ${
      runtime.config.tv_name || runtime.config.tv_ip
    }, reconnecting automatically`,
  );

  await new Promise((resolve) => setTimeout(resolve, initialDelay));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (runtime.client) {
      runtime.reconnecting = false;

      return;
    }

    try {
      logger.info(
        `LG webOS automatic reconnect attempt ${attempt}/${maxAttempts} for ${
          runtime.config.tv_name || runtime.config.tv_ip
        }`,
      );

      await connectTv(runtime);

      runtime.reconnecting = false;

      logger.info(
        `LG webOS automatically reconnected to ${runtime.config.tv_name || runtime.config.tv_ip}`,
      );

      return;
    } catch (error) {
      logger.debug(
        `LG webOS automatic reconnect attempt ${attempt}/${maxAttempts} failed for ${
          runtime.config.tv_name || runtime.config.tv_ip
        }`,
        error,
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  runtime.reconnecting = false;

  logger.warn(
    `LG webOS automatic reconnect failed for ${
      runtime.config.tv_name || runtime.config.tv_ip
    } after ${maxAttempts} attempts`,
  );

  await updateConnectionStatus().catch(() => {});
}

async function adoptDiscoveredDevice(device) {
  const params = Object.fromEntries((device?.params || []).map(({ name, value }) => [name, value]));

  if (!params.ip || !params.udn) {
    return;
  }

  const runtime = getOrCreateRuntimeForDevice(device);

  runtime.config = normalizeConfig({
    tv_ip: params.ip,
    tv_udn: params.udn,
    tv_name: device.name || runtime.config.tv_name,
    tv_mac: params.mac || runtime.config.tv_mac,
    tv_platform_id: params.platform_id || runtime.config.tv_platform_id || params.udn,
    connection_mode: runtime.config.connection_mode || defaultRuntime.config.connection_mode,
  });

  registerRuntime(runtime);

  await persistRuntime(runtime);

  logger.info(`LG webOS TV persisted: ${runtime.config.tv_name || runtime.config.tv_ip}`);

  await publishConfiguredDevice(runtime);

  try {
    await connectTv(runtime);
  } catch (error) {
    logger.warn('Discovered LG webOS TV was added but is not reachable for pairing yet', error);

    await updateConnectionStatus().catch(() => {});
  }
}

gladys.onScanRequest(scanTelevisions);

gladys.onDeviceCreated(adoptDiscoveredDevice);

gladys.onSetValue(async (device, feature, value) => {
  const runtime = getRuntimeForDevice(device);

  logger.info(
    `LG webOS onSetValue: feature=${feature.external_id}, value=${JSON.stringify(
      value,
    )}, clientConnected=${Boolean(runtime.client)}`,
  );

  if (feature.external_id.endsWith(`:${FEATURE_KEYS.POWER}`) && Number(value) === 1) {

    const wasConnected = Boolean(runtime.client);

    runtime.wakingUp = !wasConnected;

    logger.info('LG webOS Power command interpreted as ON -> Wake-on-LAN');

    try {
      await setTelevisionValue({
        gladys,
        client: runtime.client,
        config: runtime.config,
        feature,
        value,
      });

      await publishPowerState(gladys, runtime.config, 1).catch(() => {});
    } catch (error) {
      runtime.wakingUp = false;

      logger.warn('Unable to set LG webOS Power ON', error);

      throw error;
    }

    if (!wasConnected) {
      reconnectTvAfterWake(runtime).catch((error) => {
        logger.warn('Unable to reconnect LG webOS after Wake-on-LAN', error);
      });
    }

    return;
  }

  if (!runtime.client) {
    throw new Error('LG webOS TV is not connected.');
  }

  await setTelevisionValue({
    gladys,
    client: runtime.client,
    config: runtime.config,
    feature,
    value,
  });
});

async function rePairTv(runtime) {
  const previousClientKey = runtime.config.client_key;
  const tvLabel = runtime.config.tv_name || runtime.config.tv_ip;

  logger.info(`LG webOS re-pairing requested for ${tvLabel}`);

  runtime.config = normalizeConfig({
    ...runtime.config,
    client_key: '',
  });

  try {
    // Give the user enough time to accept the authorization prompt on this TV.
    await connectTv(runtime, {
      timeout: 60000,
    });

    if (!runtime.config.client_key) {
      throw new Error('LG webOS pairing completed without receiving a client key.');
    }

    // The registered event already persists the key, but persist again here so the
    // action only returns once the selected TV configuration is durably updated.
    await persistRuntime(runtime);

    logger.info(`LG webOS re-pairing succeeded for ${tvLabel}`);

    return runtime.config.client_key;
  } catch (error) {
    logger.warn(`LG webOS re-pairing failed for ${tvLabel}`, error);

    // Keep the previous authorization usable if the new pairing is cancelled or times out.
    runtime.config = normalizeConfig({
      ...runtime.config,
      client_key: previousClientKey,
    });

    await persistRuntime(runtime).catch(() => {});

    if (previousClientKey) {
      await connectTv(runtime).catch((reconnectError) => {
        logger.warn(`Unable to restore previous LG webOS connection for ${tvLabel}`, reconnectError);
      });
    }

    throw error;
  }
}

gladys.onAction('configure_tv', async (fields) => {
  if (!fields.device) {
    throw new Error('Select an LG webOS TV before saving its MAC address.');
  }

  const mac = String(fields.mac || '').trim();

  if (mac && !/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) {
    throw new Error('Invalid MAC address format. Expected AA:BB:CC:DD:EE:FF.');
  }

  const runtime = getRuntimeForDevice({
    external_id: fields.device,
  });

  if (!runtime?.config?.tv_ip) {
    throw new Error('Unable to find the selected LG webOS TV.');
  }

  runtime.config = normalizeConfig({
    ...runtime.config,
    tv_mac: mac || runtime.config.tv_mac,
  });

  await persistRuntime(runtime);

  logger.info(
    `LG webOS TV configuration updated: ${runtime.config.tv_name || runtime.config.tv_ip}`,
  );

  return {
    en: `${runtime.config.tv_name} configuration saved.`,
    fr: `Configuration de ${runtime.config.tv_name} enregistrée.`,
    de: `Konfiguration von ${runtime.config.tv_name} gespeichert.`,
  };
});

gladys.onAction('re_pair_tv', async (fields) => {
  if (!fields.device) {
    throw new Error('Select an LG webOS TV to re-pair.');
  }

  const runtime = getRuntimeForDevice({
    external_id: fields.device,
  });

  if (!runtime?.config?.tv_ip) {
    throw new Error('Unable to find the selected LG webOS TV.');
  }

  const tvLabel = runtime.config.tv_name || runtime.config.tv_ip;

  await rePairTv(runtime);

  return {
    en: `${tvLabel} paired successfully.`,
    fr: `${tvLabel} réappairée avec succès.`,
    de: `${tvLabel} wurde erfolgreich neu gekoppelt.`,
  };
});

gladys.onAction('test_connection', async () => {
  const televisionRuntimes = getUniqueRuntimes();

  if (!televisionRuntimes.length) {
    throw new Error('No LG webOS TV is configured.');
  }

  const results = await Promise.all(
    televisionRuntimes.map(async (runtime) => {
      try {
        await connectTv(runtime);

        return {
          runtime,
          success: true,
        };
      } catch (error) {
        logger.warn(
          `Unable to connect to LG webOS TV ${
            runtime.config.tv_name || runtime.config.tv_ip
          } during connection test`,
          error,
        );

        return {
          runtime,
          success: false,
        };
      }
    }),
  );

  await updateConnectionStatus();

  const connected = results.filter((result) => result.success);

  const failed = results.filter((result) => !result.success);

  const connectedNames = connected.map(
    ({ runtime }) => runtime.config.tv_name || runtime.config.tv_ip,
  );

  const failedNames = failed.map(({ runtime }) => runtime.config.tv_name || runtime.config.tv_ip);

  return {
    en:
      failed.length === 0
        ? `Successfully connected to ${connected.length} TV(s): ${connectedNames.join(', ')}.`
        : `Connected to ${connected.length}/${results.length} TV(s). Connected: ${
            connectedNames.join(', ') || 'none'
          }. Unreachable: ${failedNames.join(', ')}.`,
    fr:
      failed.length === 0
        ? `Connexion réussie à ${connected.length} TV : ${connectedNames.join(', ')}.`
        : `Connexion à ${connected.length}/${results.length} TV. Connectées : ${
            connectedNames.join(', ') || 'aucune'
          }. Injoignables : ${failedNames.join(', ')}.`,
    de:
      failed.length === 0
        ? `Verbindung zu ${connected.length} TV(s) erfolgreich: ${connectedNames.join(', ')}.`
        : `Verbindung zu ${connected.length}/${results.length} TV(s). Verbunden: ${
            connectedNames.join(', ') || 'keine'
          }. Nicht erreichbar: ${failedNames.join(', ')}.`,
  };
});

gladys.onConfigUpdated(async (newConfig) => {
  const globalConfig = normalizeConfig(newConfig);

  defaultRuntime.config = globalConfig;

  const televisionsConfig = normalizeTelevisionsConfig(newConfig);

  if (Object.keys(televisionsConfig).length) {
    for (const [id, televisionConfig] of Object.entries(televisionsConfig)) {
      let runtime = findRuntimeById(id);

      if (!runtime) {
        runtime = createTelevisionRuntime(televisionConfig);

        registerRuntime(runtime);
      } else {
        runtime.config = normalizeConfig({
          ...runtime.config,
          ...televisionConfig,
        });

        registerRuntime(runtime);
      }
    }

    const connectionMode = globalConfig.connection_mode;

    if (connectionMode) {
      for (const runtime of getUniqueRuntimes()) {
        if (runtime.config.connection_mode === connectionMode) {
          continue;
        }

        runtime.config = normalizeConfig({
          ...runtime.config,
          connection_mode: connectionMode,
        });

        await persistRuntime(runtime);
      }
    }

    await Promise.all(
      getUniqueRuntimes().map(async (runtime) => {
        try {
          await publishConfiguredDevice(runtime);

          await connectTv(runtime);
        } catch (error) {
          logger.warn(
            `Unable to reconnect LG webOS TV ${
              runtime.config.tv_name || runtime.config.tv_ip
            } after configuration update`,
            error,
          );
        }
      }),
    );

    await updateConnectionStatus();

    return;
  }

  for (const runtime of getUniqueRuntimes()) {
    if (runtime !== defaultRuntime) {
      await disconnectTv(runtime).catch(() => {});
    }
  }

  clearRuntimes();

  if (!defaultRuntime.config.tv_ip) {
    await updateConnectionStatus();

    return;
  }

  registerRuntime(defaultRuntime);

  await publishConfiguredDevice(defaultRuntime);

  try {
    await connectTv(defaultRuntime);
  } catch (error) {
    logger.warn('Unable to connect to LG webOS after configuration update', error);

    await updateConnectionStatus();
  }
});

gladys.on('connected', async () => {
  const savedConfig = await gladys.getConfig();

  defaultRuntime.config = normalizeConfig(savedConfig);

  const televisionsConfig = normalizeTelevisionsConfig(savedConfig);

  clearRuntimes();

  if (!Object.keys(televisionsConfig).length) {
    registerRuntime(defaultRuntime);

    await publishConfiguredDevice(defaultRuntime);

    if (!defaultRuntime.config.tv_ip) {
      await updateConnectionStatus();

      return;
    }

    try {
      await connectTv(defaultRuntime);
    } catch (error) {
      logger.warn('LG webOS TV is currently unreachable', error);

      await updateConnectionStatus();
    }

    return;
  }

  const televisionRuntimes = Object.values(televisionsConfig).map((televisionConfig) => {
    const runtime = createTelevisionRuntime(televisionConfig);

    registerRuntime(runtime);

    return runtime;
  });

  logger.info(`LG webOS loading ${televisionRuntimes.length} configured TV(s).`);

  await Promise.all(
    televisionRuntimes.map(async (runtime) => {
      await publishConfiguredDevice(runtime);

      try {
        await connectTv(runtime);
      } catch (error) {
        logger.warn(
          `LG webOS TV ${runtime.config.tv_name || runtime.config.tv_ip} is currently unreachable`,
          error,
        );
      }
    }),
  );

  await updateConnectionStatus();
});

gladys.handleShutdown(async () => {
  await Promise.all(getUniqueRuntimes().map((runtime) => disconnectTv(runtime)));
});

logger.info('Starting LG webOS integration...');

gladys.connect().catch((error) => {
  logger.error('Initial connection to Gladys failed', error);

  process.exit(1);
});
