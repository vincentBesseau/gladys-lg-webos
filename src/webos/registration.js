export function buildRegistrationPayload(clientKey) {
  return {
    'client-key': clientKey || undefined,
    forcePairing: false,
    pairingType: 'PROMPT',
    manifest: {
      manifestVersion: 1,
      appVersion: '1.0.0',
      // Recent LG webOS firmwares (2022/2023+) reject the historical signed test
      // manifest with "403 Pairing rejected: blacklisted certificate detected",
      // so no prompt appears on the TV. Sending an unsigned manifest (manifest
      // version, app version and permissions only), like aiowebostv and Home
      // Assistant do, makes the prompt appear and pairing succeed.
      permissions: [
        'LAUNCH',
        'CLOSE',
        'CONTROL_AUDIO',
        'CONTROL_INPUT_MEDIA_PLAYBACK',
        'CONTROL_MOUSE_AND_KEYBOARD',
        'CONTROL_INPUT_TV',
        'CONTROL_POWER',
        'READ_APP_STATUS',
        'READ_CURRENT_CHANNEL',
        'READ_INPUT_DEVICE_LIST',
        'READ_RUNNING_APPS',
        'READ_INSTALLED_APPS',
        'READ_TV_CHANNEL_LIST',
        'WRITE_NOTIFICATION_TOAST',
        'READ_POWER_STATE',
        'CONTROL_TV_POWER',
        'CONTROL_WOL',
      ],
    },
  };
}
