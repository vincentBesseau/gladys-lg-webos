# Gladys LG webOS integration

[![Latest version](https://img.shields.io/github/v/release/vincentBesseau/gladys-lg-webos?label=version)](https://github.com/vincentBesseau/gladys-lg-webos/releases/latest)
[![CI](https://github.com/vincentBesseau/gladys-lg-webos/actions/workflows/ci.yml/badge.svg)](https://github.com/vincentBesseau/gladys-lg-webos/actions/workflows/ci.yml)
[![Docker pulls](https://ghcr-badge.elias.eu.org/shield/vincentBesseau/gladys-lg-webos/gladys-lg-webos)](https://github.com/vincentBesseau/gladys-lg-webos/pkgs/container/gladys-lg-webos)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](https://www.apache.org/licenses/LICENSE-2.0)
[![Gladys](https://img.shields.io/badge/gladys-%3E%3D4.86.1-6f42c1)](https://gladysassistant.com)

External integration for [Gladys Assistant](https://gladysassistant.com) that
controls **LG webOS televisions** over the local network.

Built on the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

The integration communicates directly with the television using the native
LG webOS WebSocket API. No cloud account is required.

---

## What it does

- **Discovers LG webOS TVs** on the local network using SSDP.
- **Pairs securely with the TV** using the native LG authorization prompt.
- **Stores the client key** securely in the integration configuration for future reconnects.
- **Communicates entirely locally** over the LG WebSocket protocol.
- **Automatically reconnects** after Gladys or TV restarts.
- **Synchronizes the TV state** with Gladys.

Each television exposes these features:

| Feature         | Category / type              |
| --------------- | ---------------------------- |
| Power           | `television` / `binary`      |
| Volume          | `television` / `volume`      |
| Mute            | `television` / `volume-mute` |
| Play            | `television` / `play`        |
| Pause           | `television` / `pause`       |
| Stop            | `television` / `stop`        |
| Channel +       | `television` / `button`      |
| Channel -       | `television` / `button`      |
| Volume +        | `television` / `button`      |
| Volume -        | `television` / `button`      |
| TV notification | `text` / `text`              |

The integration also supports **Wake-on-LAN** to power on compatible TVs.

---

## Configuration

No manual IP configuration is required.

1. Install the integration.
2. Open the **Discovery** page in Gladys.
3. Start a network scan.
4. Select your LG television.
5. Accept the authorization request displayed on the TV.

The integration stores the generated client key and reconnects automatically on
future starts.

If Wake-on-LAN is required, simply enter the TV MAC address in the integration
configuration.

---

## TV notifications

The integration can display native LG notifications directly on the TV.

Typical examples:

- Laundry finished
- Someone is at the front door
- Alarm activated
- Dinner is ready

Notifications appear using the standard webOS toast notification system.

---

## Development

```bash
npm install
npm test
npm run lint
npm run format
```

---

## Roadmap

### Current

- ✅ SSDP discovery
- ✅ Pairing
- ✅ Power off
- ✅ Wake-on-LAN
- ✅ Volume
- ✅ Mute
- ✅ Playback controls
- ✅ TV notifications

### Planned

- HDMI source selection
- Installed applications
- Application launcher
- Current application feedback
- Media information
- Input status
- Additional subscriptions from the webOS API

---

## Compatibility

Tested with LG televisions running **webOS**.

Older and newer versions should work as long as the native LG WebSocket API is
available.

If your television is not detected, please open an issue including the model
number and webOS version.

---

## License

Apache-2.0
