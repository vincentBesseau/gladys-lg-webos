import { logger } from '@gladysassistant/integration-sdk';

export const WEBOS_SSDP_ST = 'urn:lge-com:service:webos-second-screen:1';

function getHeader(entry, name) {
  const wanted = name.toLowerCase();

  if (typeof entry?.headers === 'string') {
    for (const line of entry.headers.split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      if (key !== wanted) continue;

      return line.slice(separatorIndex + 1).trim();
    }
  }

  const sources = [entry?.headers, entry].filter((value) => value && typeof value === 'object');

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (key.toLowerCase() === wanted) return value;
    }
  }

  return undefined;
}

function xmlValue(xml, tag) {
  const match = String(xml).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function decodeXml(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function ipFromLocation(location) {
  try {
    return new URL(location).hostname;
  } catch {
    return '';
  }
}

function normalizeUdn(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';
  const uuidMatch = raw.match(/uuid:[^:\s>]+/i);
  return (uuidMatch?.[0] || raw.split('::')[0]).toLowerCase();
}

export async function fetchDeviceDescription(location, fetchImpl = fetch) {
  if (!location) return {};
  try {
    const response = await fetchImpl(location, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return {};
    const xml = await response.text();
    return {
      friendlyName: xmlValue(xml, 'friendlyName'),
      manufacturer: xmlValue(xml, 'manufacturer'),
      modelName: xmlValue(xml, 'modelName'),
      modelNumber: xmlValue(xml, 'modelNumber'),
      serialNumber: xmlValue(xml, 'serialNumber'),
      udn: normalizeUdn(xmlValue(xml, 'UDN')),
    };
  } catch {
    return {};
  }
}

export async function discoverWebOsTelevisions(
  gladys,
  { timeoutSeconds = 5, fetchImpl = fetch } = {},
) {
  const responses = await gladys.scanNetwork('ssdp', {
    st: WEBOS_SSDP_ST,
    timeoutSeconds,
  });
  logger.info('LG WEBOS SSDP RAW:', JSON.stringify(responses, null, 2));
  const televisions = new Map();
  for (const entry of responses || []) {
    const location = String(getHeader(entry, 'location') || '').trim();
    const usn = String(getHeader(entry, 'usn') || '').trim();
    const st = String(getHeader(entry, 'st') || WEBOS_SSDP_ST).trim();
    if (st && st.toLowerCase() !== WEBOS_SSDP_ST.toLowerCase()) continue;

    const details = await fetchDeviceDescription(location, fetchImpl);
    const ip = String(entry?.source_ip || ipFromLocation(location)).trim();
    const udn = details.udn || normalizeUdn(usn);
    if (!ip || !udn) continue;

    if (
      details.manufacturer &&
      !/\blg\b/i.test(details.manufacturer) &&
      !/webos/i.test(details.manufacturer)
    )
      continue;

    const name = details.friendlyName || details.modelName || `LG webOS TV (${ip})`;
    televisions.set(udn, {
      ip,
      udn,
      name,
      model: details.modelName || details.modelNumber || '',
      serial: details.serialNumber || '',
      location,
    });
  }

  return [...televisions.values()];
}
