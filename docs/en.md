# LG webOS

This integration controls an LG webOS TV locally from Gladys Assistant.

## Automatic discovery

1. Install and start the integration without entering an IP address.
2. Open the **Discover** tab and click **Scan**.
3. Gladys sends an SSDP search for `urn:lge-com:service:webos-second-screen:1` from the host network.
4. The integration reads each TV UPnP description to obtain its name, model and stable UDN.
5. Add your TV to Gladys. Its IP address and UDN are stored automatically.
6. Turn the TV on and accept the webOS pairing prompt on the first connection.

The TV UDN is used as the stable identifier. A later scan can therefore refresh a changed DHCP address without recreating the Gladys device.

## Wake-on-LAN

SSDP does not reliably expose the TV MAC address. Discovery, control while powered on, and power-off work without it, but turning the TV **on** from Gladys requires the MAC address in the integration configuration.

Keeping a DHCP reservation for the TV is still recommended.

## Connection

**Automatic** mode tries `ws://TV:3000` and then `wss://TV:3001`. Some recent webOS firmwares require the secure port with a self-signed certificate.

The integration exposes power, volume, mute, play/pause/stop, volume +/-, channel +/- and TV toast notifications.
