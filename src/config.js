const DEFAULTS = Object.freeze({
  tv_ip: '',
  tv_mac: '',
  tv_name: 'LG webOS TV',
  tv_udn: '',
  tv_platform_id: '',
  connection_mode: 'auto',
  client_key: '',
});

export function normalizeMac(value = '') {
  const compact = String(value)
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
  if (!compact) return '';
  if (compact.length !== 12) return String(value).trim().toUpperCase();
  return compact.match(/.{2}/g).join(':');
}

export function normalizeConfig(input = {}) {
  const config = { ...DEFAULTS, ...input };
  return {
    tv_ip: String(config.tv_ip ?? '').trim(),
    tv_mac: normalizeMac(config.tv_mac),
    tv_name: String(config.tv_name || DEFAULTS.tv_name).trim(),
    tv_udn: String(config.tv_udn ?? '')
      .trim()
      .toLowerCase(),
    tv_platform_id: String(config.tv_platform_id ?? '')
      .trim()
      .toLowerCase(),
    connection_mode: ['auto', 'ws', 'wss'].includes(config.connection_mode)
      ? config.connection_mode
      : DEFAULTS.connection_mode,
    client_key: String(config.client_key ?? '').trim(),
  };
}

export function validateConfig(config) {
  if (!config.tv_ip)
    throw new Error('TV IP address is required. Run a network scan or configure it manually.');
  if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(config.tv_ip)) {
    throw new Error('TV IP address is invalid.');
  }
  if (config.tv_mac && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(config.tv_mac)) {
    throw new Error('TV MAC address is invalid.');
  }
}
