import { normalizeConfig } from '../config.js';
import { buildTelevisionDevice, paramsToObject } from '../devices/television.js';

export function createTelevisionRuntime(config = {}) {
  return {
    config: normalizeConfig(config),
    client: null,
    stopSubscriptions: () => {},
    wakingUp: false,
    reconnecting: false,
    intentionalDisconnect: false,
  };
}

export function createTelevisionRuntimeRegistry(gladys, defaultRuntime) {
  const runtimes = new Map();

  function registerRuntime(runtime) {
    const device = buildTelevisionDevice(gladys, runtime.config);

    if (!device) {
      return null;
    }

    runtimes.set(device.external_id, runtime);

    return device;
  }

  function getRuntimeForDevice(device) {
    const runtime = runtimes.get(device?.external_id);

    if (runtime) {
      return runtime;
    }

    throw new Error(`No LG webOS runtime found for device ${device?.external_id || 'unknown'}.`);
  }

  function getOrCreateRuntimeForDevice(device) {
    const existingRuntime = runtimes.get(device?.external_id);

    if (existingRuntime) {
      return existingRuntime;
    }

    const params = paramsToObject(device);

    const runtime = createTelevisionRuntime({
      connection_mode: defaultRuntime.config.connection_mode,
      tv_ip: params.ip,
      tv_mac: params.mac,
      tv_udn: params.udn,
      tv_name: device?.name,
      tv_platform_id: params.platform_id || params.udn,
    });

    registerRuntime(runtime);

    return runtime;
  }

  function getRuntimeId(runtime) {
    return runtime.config.tv_platform_id || runtime.config.tv_udn || runtime.config.tv_mac;
  }

  function getUniqueRuntimes() {
    return [...new Set(runtimes.values())];
  }

  function findRuntimeForTelevision(television) {
    return getUniqueRuntimes().find(
      (runtime) =>
        runtime.config.tv_udn === television.udn || runtime.config.tv_ip === television.ip,
    );
  }

  function findRuntimeById(id) {
    return getUniqueRuntimes().find((runtime) => getRuntimeId(runtime) === id);
  }

  function clearRuntimes() {
    runtimes.clear();
  }

  return {
    registerRuntime,
    getRuntimeForDevice,
    getOrCreateRuntimeForDevice,
    getRuntimeId,
    getUniqueRuntimes,
    findRuntimeForTelevision,
    findRuntimeById,
    clearRuntimes,
  };
}
