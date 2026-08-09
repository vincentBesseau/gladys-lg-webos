import dgram from 'node:dgram';

export function buildMagicPacket(mac) {
  const bytes = mac.split(':').map((part) => Number.parseInt(part, 16));
  if (bytes.length !== 6 || bytes.some((value) => Number.isNaN(value))) {
    throw new Error('Invalid MAC address.');
  }
  return Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => Buffer.from(bytes))]);
}

export async function wakeOnLan(mac, broadcastAddress = '255.255.255.255', port = 9) {
  const socket = dgram.createSocket('udp4');
  const packet = buildMagicPacket(mac);
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(() => {
        socket.setBroadcast(true);
        socket.send(packet, port, broadcastAddress, (error) => (error ? reject(error) : resolve()));
      });
    });
  } finally {
    socket.close();
  }
}
