# LG webOS

This integration controls LG webOS TVs locally from Gladys Assistant.

## Automatic discovery

1. Turn the TV on, then install and start the integration without entering an IP address.
2. Open the **Discover** tab and click **Scan**.
3. Gladys sends an SSDP search for `urn:lge-com:service:webos-second-screen:1` from the host network.
4. The integration reads each TV UPnP description to obtain its name, model and stable UDN.
5. Add your TV to Gladys. Its IP address and UDN are stored automatically.
6. On the first connection, a webOS pairing request appears on the TV: accept it using the remote control.

The TV UDN is used as the stable identifier. A later scan can therefore refresh a changed DHCP address without recreating the Gladys device.

## Wake-on-LAN

SSDP does not reliably expose the TV MAC address. Control while the TV is powered on and power-off work without a MAC address, but it is required to **turn on** the TV from Gladys using Wake-on-LAN.

After adding a TV, use the **Configure a TV** action in the integration configuration, select the relevant TV and enter its MAC address.

Each added TV has its own configuration, allowing Wake-on-LAN to be used with multiple LG webOS TVs.

Keeping a DHCP reservation or static IP address for each TV is recommended, even though discovery can detect and update a changed IP address.

## Connection

**Automatic** mode tries `ws://TV:3000` and then `wss://TV:3001`. Some recent webOS firmwares require the secure port with a self-signed certificate.

The integration maintains a WebSocket connection with each configured TV. If the connection is unexpectedly lost, it automatically attempts to reconnect. After the TV is started using Wake-on-LAN, the integration waits for webOS to become available and automatically restores the connection.

The integration exposes power, volume, mute, play/pause/stop, volume +/-, channel +/- and TV toast notifications.
