import dgram from 'node:dgram';

export function buildMagicPacket(mac) {
  const bytes = mac.split(':').map((part) => Number.parseInt(part, 16));

  if (bytes.length !== 6 || bytes.some(Number.isNaN)) {
    throw new Error('Invalid MAC address.');
  }

  return Buffer.concat([
    Buffer.alloc(6, 0xff),
    ...Array.from({ length: 16 }, () => Buffer.from(bytes)),
  ]);
}

function sendPacket(packet, broadcastAddress, port) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');

    socket.once('error', (error) => {
      socket.close();
      reject(error);
    });

    socket.bind(0, () => {
      socket.setBroadcast(true);

      socket.send(packet, port, broadcastAddress, (error) => {
        socket.close();

        if (error) {
          reject(error);
        } else {
          resolve();
        }
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
