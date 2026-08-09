export function buildRegistrationPayload(clientKey) {
  return {
    'client-key': clientKey || undefined,
    forcePairing: false,
    pairingType: 'PROMPT',
    manifest: {
      manifestVersion: 1,
      appVersion: '1.0.0',
      signed: {
        created: '20140509',
        appId: 'com.lge.test',
        vendorId: 'com.lge',
        localizedAppNames: { '': 'Gladys Assistant' },
        localizedVendorNames: { '': 'Gladys Assistant' },
        permissions: [
          'TEST_SECURE',
          'CONTROL_INPUT_TEXT',
          'CONTROL_MOUSE_AND_KEYBOARD',
          'READ_INSTALLED_APPS',
          'READ_NOTIFICATIONS',
          'WRITE_SETTINGS',
          'WRITE_NOTIFICATION_ALERT',
          'CONTROL_POWER',
          'READ_CURRENT_CHANNEL',
          'READ_RUNNING_APPS',
          'READ_LGE_TV_INPUT_EVENTS',
        ],
        serial: 'gladys-lg-webos',
      },
      permissions: [
        'LAUNCH',
        'CLOSE',
        'CONTROL_AUDIO',
        'CONTROL_INPUT_MEDIA_PLAYBACK',
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
      signatures: [
        {
          signatureVersion: 1,
          signature:
            'eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw==',
        },
      ],
    },
  };
}
