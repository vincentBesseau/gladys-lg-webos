import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverWebOsTelevisions, fetchDeviceDescription, WEBOS_SSDP_ST } from '../src/discovery/ssdp.js';

const xml = `<?xml version="1.0"?>
<root><device>
<friendlyName>[LG] webOS TV OLED55C3</friendlyName>
<manufacturer>LG Electronics</manufacturer>
<modelName>OLED55C3</modelName>
<modelNumber>OLED55C36LC</modelNumber>
<serialNumber>123456789</serialNumber>
<UDN>uuid:12345678-1234-1234-1234-123456789abc</UDN>
</device></root>`;

test('parses the LG UPnP device description', async () => {
  const details = await fetchDeviceDescription('http://192.168.1.40:3000/', async () => ({
    ok: true,
    text: async () => xml,
  }));

  assert.deepEqual(details, {
    friendlyName: '[LG] webOS TV OLED55C3',
    manufacturer: 'LG Electronics',
    modelName: 'OLED55C3',
    modelNumber: 'OLED55C36LC',
    serialNumber: '123456789',
    udn: 'uuid:12345678-1234-1234-1234-123456789abc',
  });
});

test('discovers and deduplicates LG webOS TVs from SSDP', async () => {
  const gladys = {
    scanNetwork: async (type, options) => {
      assert.equal(type, 'ssdp');
      assert.deepEqual(options, { st: WEBOS_SSDP_ST, timeoutSeconds: 5 });
      return [
        {
          LOCATION: 'http://192.168.1.40:3000/',
          USN: 'uuid:12345678-1234-1234-1234-123456789abc::urn:lge-com:service:webos-second-screen:1',
          ST: WEBOS_SSDP_ST,
          source_ip: '192.168.1.40',
        },
        {
          headers: {
            location: 'http://192.168.1.40:3000/',
            usn: 'uuid:12345678-1234-1234-1234-123456789abc::urn:lge-com:service:webos-second-screen:1',
            st: WEBOS_SSDP_ST,
          },
          source_ip: '192.168.1.40',
        },
      ];
    },
  };

  const televisions = await discoverWebOsTelevisions(gladys, {
    fetchImpl: async () => ({ ok: true, text: async () => xml }),
  });

  assert.equal(televisions.length, 1);
  assert.deepEqual(televisions[0], {
    ip: '192.168.1.40',
    udn: 'uuid:12345678-1234-1234-1234-123456789abc',
    name: '[LG] webOS TV OLED55C3',
    model: 'OLED55C3',
    serial: '123456789',
    location: 'http://192.168.1.40:3000/',
  });
});

test('ignores a non-LG description even if it replies to the scan', async () => {
  const gladys = {
    scanNetwork: async () => [
      {
        location: 'http://192.168.1.50/device.xml',
        usn: 'uuid:not-lg::urn:lge-com:service:webos-second-screen:1',
        st: WEBOS_SSDP_ST,
        source_ip: '192.168.1.50',
      },
    ],
  };
  const televisions = await discoverWebOsTelevisions(gladys, {
    fetchImpl: async () => ({
      ok: true,
      text: async () => '<root><device><manufacturer>Other Vendor</manufacturer><UDN>uuid:not-lg</UDN></device></root>',
    }),
  });
  assert.deepEqual(televisions, []);
});
