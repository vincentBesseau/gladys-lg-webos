import dgram from 'node:dgram';
import { logger } from '@gladysassistant/integration-sdk';

export function buildMagicPacket(mac) {
  const bytes = mac.split(':').map((part) => Number.parseInt(part, 16));

  if (bytes.length !== 6 || bytes.some(Number.isNaN)) {
    throw new Error('Invalid MAC address.');
  }

  const packet = Buffer.concat([
    Buffer.alloc(6, 0xff),
    ...Array.from({ length: 16 }, () => Buffer.from(bytes)),
  ]);

  logger.debug(
    `LG webOS WOL packet built: mac=${mac}, bytes=${packet.length}, payload=${packet.toString('hex')}`,
  );

  return packet;
}

function sendPacket(packet, broadcastAddress, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');

    socket.once('error', (error) => {
      logger.error(`LG webOS WOL socket error: destination=${broadcastAddress}:${port}`, error);
      socket.close();
      reject(error);
    });

    socket.bind(0, () => {
      const source = socket.address();
      socket.setBroadcast(true);

      socket.send(packet, port, broadcastAddress, (error) => {
        socket.close();
        logger.info(
          `LG webOS WOL socket ready: source=${source.address}:${source.port}, destination=${broadcastAddress}:${port}`,
        );

        if (error) {
          logger.error(
            `LG webOS WOL send failed: source=${source.address}:${source.port}, destination=${broadcastAddress}:${port}`,
            error,
          );
          socket.close();
          reject(error);
        } else {
          resolve();
          return;
        }

        logger.info(
          `LG webOS WOL packet sent: source=${source.address}:${source.port}, destination=${broadcastAddress}:${port}, bytes=${packet.length}`,
        );
        socket.close();
        resolve();
      });
    });
  });
}

export async function wakeOnLan(mac, broadcastAddress = '192.168.1.255', port = 9) {
  const packet = buildMagicPacket(mac);

  await Promise.all([
    sendPacket(packet, broadcastAddress, port),
    sendPacket(packet, broadcastAddress, port),
    sendPacket(packet, broadcastAddress, port),
  ]);
}
