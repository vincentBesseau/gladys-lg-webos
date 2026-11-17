import { FEATURE_KEYS } from './devices/television.js';

// Read the current TV state from a device returned by gladys.getDevices(), so
// the widget shows reliable text values (volume, source, app, channel) instead
// of relying on live tiles bound to text features, which do not render a string.
export function readTvWidgetState(device) {
  const byKey = new Map();

  for (const feature of device?.features || []) {
    byKey.set(feature.external_id.split(':').at(-1), feature);
  }

  const readNumber = (key) => {
    const value = byKey.get(key)?.last_value;
    return typeof value === 'number' ? value : undefined;
  };

  const readText = (key) => {
    const value = byKey.get(key)?.last_value_string;
    return value ? String(value) : '';
  };

  // The source feature stores the raw input id (HDMI_1…); map it to its label
  // when the feature exposes the options.
  const rawSource = readText(FEATURE_KEYS.SOURCE);
  const sourceOption = (byKey.get(FEATURE_KEYS.SOURCE)?.supported_options || []).find(
    (option) => option.value === rawSource,
  );

  return {
    tvName: device?.name || 'TV',
    volume: readNumber(FEATURE_KEYS.VOLUME),
    muted: readNumber(FEATURE_KEYS.MUTE) === 1,
    application: readText(FEATURE_KEYS.CURRENT_APP),
    channel: readText(FEATURE_KEYS.CURRENT_CHANNEL),
    source: sourceOption?.label || rawSource,
  };
}

// What the TV is actually showing right now, from the foreground app id — only
// one of source / channel / application can be active at a time. Used to put a
// green dot on the matching status row.
export function classifyForeground(appId) {
  const id = String(appId || '').toLowerCase();

  if (!id) {
    return '';
  }

  if (id.includes('livetv')) {
    return 'channel';
  }

  if (
    id.includes('hdmi') ||
    id.includes('externalinput') ||
    id.includes('component') ||
    id.endsWith('.av')
  ) {
    return 'source';
  }

  return 'application';
}

// Build the status rows of the TV widget, skipping anything we have no value
// for (e.g. no channel on an HDMI input → show the source instead). `activeRow`
// ('source' | 'channel' | 'application') gets a green dot: it is what is on
// screen right now.
export function buildTvStatusItems(state, activeRow = '') {
  const items = [];

  const green = (row) => (row === activeRow ? { color: 'success' } : {});

  if (state.volume !== undefined) {
    items.push({
      label: { en: 'Volume', fr: 'Volume', de: 'Lautstärke' },
      value: state.muted ? `${state.volume} 🔇` : state.volume,
    });
  }

  if (state.source) {
    items.push({
      label: { en: 'Source', fr: 'Source', de: 'Quelle' },
      value: state.source,
      ...green('source'),
    });
  }

  if (state.channel) {
    items.push({
      label: { en: 'Channel', fr: 'Chaîne', de: 'Sender' },
      value: state.channel,
      ...green('channel'),
    });
  }

  if (state.application) {
    items.push({
      label: { en: 'App', fr: 'Application', de: 'App' },
      value: state.application,
      ...green('application'),
    });
  }

  return items;
}
