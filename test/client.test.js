import test from 'node:test';
import assert from 'node:assert/strict';
import { WebOsClient } from '../src/webos/client.js';

class FakeWebSocket {
  static instances = [];
  static scenarios = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    this.scenario = FakeWebSocket.scenarios.shift() || {};

    FakeWebSocket.instances.push(this);

    queueMicrotask(() => {
      this.scenario.onCreate?.(this);
    });
  }

  static reset(...scenarios) {
    FakeWebSocket.instances = [];
    FakeWebSocket.scenarios = scenarios;
  }

  addEventListener(name, callback) {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
  }

  emit(name, event = {}) {
    for (const callback of this.listeners.get(name) ?? []) {
      callback(event);
    }
  }

  open() {
    this.readyState = 1;
    this.emit('open');
  }

  error() {
    this.emit('error');
  }

  message(message) {
    this.emit('message', {
      data: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }

  send(raw) {
    this.sent.push(raw);
    const message = JSON.parse(raw);

    this.scenario.onSend?.(this, message);
  }

  close() {
    this.readyState = 3;
    this.emit('close');
  }
}

function registeredScenario(clientKey = 'abc') {
  return {
    onCreate(socket) {
      socket.open();
    },

    onSend(socket, message) {
      if (message.type === 'register') {
        queueMicrotask(() => {
          socket.message({
            id: message.id,
            type: 'registered',
            payload: {
              'client-key': clientKey,
            },
          });
        });
      }
    },
  };
}

test('registers then sends SSAP requests', async () => {
  FakeWebSocket.reset({
    ...registeredScenario(),

    onSend(socket, message) {
      if (message.type === 'register') {
        queueMicrotask(() => {
          socket.message({
            id: message.id,
            type: 'registered',
            payload: {
              'client-key': 'abc',
            },
          });
        });
      }

      if (message.type === 'request') {
        queueMicrotask(() => {
          socket.message({
            id: message.id,
            type: 'response',
            payload: {
              returnValue: true,
            },
          });
        });
      }
    },
  });

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  assert.equal(client.clientKey, 'abc');
  assert.equal(client.connectedUrl, 'ws://192.168.1.20:3000');

  const response = await client.request('ssap://audio/getVolume');

  assert.equal(response.returnValue, true);

  client.close();
});

test('returns URLs according to connection mode', () => {
  const wsClient = new WebOsClient({
    ip: '192.168.1.20',
    mode: 'ws',
    WebSocketImpl: FakeWebSocket,
  });

  const wssClient = new WebOsClient({
    ip: '192.168.1.20',
    mode: 'wss',
    WebSocketImpl: FakeWebSocket,
  });

  const autoClient = new WebOsClient({
    ip: '192.168.1.20',
    mode: 'auto',
    WebSocketImpl: FakeWebSocket,
  });

  assert.deepEqual(wsClient.urls, ['ws://192.168.1.20:3000']);
  assert.deepEqual(wssClient.urls, ['wss://192.168.1.20:3001']);
  assert.deepEqual(autoClient.urls, ['ws://192.168.1.20:3000', 'wss://192.168.1.20:3001']);
});

test('requires a WebSocket implementation', () => {
  assert.throws(
    () =>
      new WebOsClient({
        ip: '192.168.1.20',
        WebSocketImpl: null,
      }),
    /WebSocket implementation is required/,
  );
});

test('rejects requests and subscriptions while disconnected', async () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await assert.rejects(client.request('ssap://audio/getVolume'), /LG webOS TV is not connected/);

  await assert.rejects(
    client.subscribe('ssap://audio/getVolume', () => {}),
    /LG webOS TV is not connected/,
  );
});

test('subscribes, receives updates and can unsubscribe', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];
  const received = [];

  const unsubscribe = await client.subscribe('ssap://audio/getVolume', (payload) => {
    received.push(payload);
  });

  const subscribeMessage = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: subscribeMessage.id,
    type: 'response',
    payload: {
      volume: 12,
    },
  });

  assert.deepEqual(received, [{ volume: 12 }]);

  unsubscribe();

  socket.message({
    id: subscribeMessage.id,
    type: 'response',
    payload: {
      volume: 13,
    },
  });

  assert.deepEqual(received, [{ volume: 12 }]);

  client.close();
});

test('times out an unanswered request', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    timeout: 5,
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  await assert.rejects(client.request('ssap://audio/getVolume'), /LG webOS request timed out/);

  client.close();
});

test('rejects pending requests when closed', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    timeout: 1000,
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const request = client.request('ssap://audio/getVolume');

  client.close();

  await assert.rejects(request, /LG webOS connection closed/);
});

test('falls back from ws to wss', async () => {
  FakeWebSocket.reset(
    {
      onCreate(socket) {
        socket.error();
      },
    },
    registeredScenario('fallback-key'),
  );

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  assert.equal(FakeWebSocket.instances.length, 2);
  assert.equal(FakeWebSocket.instances[0].url, 'ws://192.168.1.20:3000');
  assert.equal(FakeWebSocket.instances[1].url, 'wss://192.168.1.20:3001');
  assert.equal(client.connectedUrl, 'wss://192.168.1.20:3001');
  assert.equal(client.clientKey, 'fallback-key');

  client.close();
});

test('rejects when all connection URLs fail', async () => {
  FakeWebSocket.reset(
    {
      onCreate(socket) {
        socket.error();
      },
    },
    {
      onCreate(socket) {
        socket.error();
      },
    },
  );

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await assert.rejects(client.connect(), /LG webOS WebSocket error: wss:\/\/192\.168\.1\.20:3001/);
});

test('emits pairing before registration', async () => {
  FakeWebSocket.reset({
    onCreate(socket) {
      socket.open();
    },

    onSend(socket, message) {
      if (message.type !== 'register') return;

      queueMicrotask(() => {
        socket.message({
          id: message.id,
          type: 'response',
          payload: {},
        });

        socket.message({
          id: message.id,
          type: 'registered',
          payload: {
            'client-key': 'paired-key',
          },
        });
      });
    },
  });

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  let pairingCount = 0;

  client.on('pairing', () => {
    pairingCount += 1;
  });

  await client.connect();

  assert.equal(pairingCount, 1);
  assert.equal(client.clientKey, 'paired-key');

  client.close();
});

test('rejects when the socket closes before pairing', async () => {
  FakeWebSocket.reset({
    onCreate(socket) {
      socket.open();
    },

    onSend(socket, message) {
      if (message.type === 'register') {
        queueMicrotask(() => socket.close());
      }
    },
  });

  const client = new WebOsClient({
    ip: '192.168.1.20',
    mode: 'ws',
    WebSocketImpl: FakeWebSocket,
  });

  await assert.rejects(client.connect(), /connection closed before pairing/);
});

test('times out while connecting', async () => {
  FakeWebSocket.reset({
    onCreate() {},
  });

  const client = new WebOsClient({
    ip: '192.168.1.20',
    mode: 'ws',
    timeout: 5,
    WebSocketImpl: FakeWebSocket,
  });

  await assert.rejects(client.connect(), /LG webOS connection timed out/);
});

test('emits an error when invalid JSON is received', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  const errors = [];

  client.on('error', (error) => {
    errors.push(error);
  });

  await client.connect();

  FakeWebSocket.instances[0].message('{invalid-json');

  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Invalid JSON received from LG webOS TV/);

  client.close();
});

test('rejects an SSAP error response', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  const request = client.request('ssap://audio/getVolume');
  const message = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: message.id,
    type: 'error',
    error: '401 insufficient permissions',
  });

  await assert.rejects(request, /401 insufficient permissions/);

  client.close();
});

test('rejects a response with returnValue false', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  const request = client.request('ssap://audio/getVolume');
  const message = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: message.id,
    type: 'response',
    payload: {
      returnValue: false,
      errorText: 'Request failed',
    },
  });

  await assert.rejects(request, /Request failed/);

  client.close();
});

test('forwards subscription errors to the subscription callback', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  let receivedPayload;
  let receivedMessage;

  await client.subscribe('ssap://audio/getVolume', (payload, message) => {
    receivedPayload = payload;
    receivedMessage = message;
  });

  const subscribeMessage = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: subscribeMessage.id,
    type: 'error',
    error: 'subscription failed',
    payload: {
      returnValue: false,
    },
  });

  assert.deepEqual(receivedPayload, {
    returnValue: false,
  });

  assert.equal(receivedMessage.error, 'subscription failed');

  client.close();
});

test('ignores messages with an unknown request id', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  assert.doesNotThrow(() => {
    FakeWebSocket.instances[0].message({
      id: 'unknown',
      type: 'response',
      payload: {},
    });
  });

  client.close();
});

test('resolves an empty object when response payload is missing', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  const request = client.request('ssap://audio/getVolume');
  const message = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: message.id,
    type: 'response',
  });

  assert.deepEqual(await request, {});

  client.close();
});

test('rejects when socket exists but is not open', async () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  client.socket = {
    readyState: 0,
  };
  client.registered = true;

  await assert.rejects(client.request('ssap://audio/getVolume'), /LG webOS TV is not connected/);
});

test('rejects when socket is open but client is not registered', async () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  client.socket = {
    readyState: 1,
  };
  client.registered = false;

  await assert.rejects(client.request('ssap://audio/getVolume'), /LG webOS TV is not connected/);
});

test('close handles subscription pending entries without reject callback', () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  client.pending.set('subscription', {
    subscription: true,
    callback: () => {},
  });

  assert.doesNotThrow(() => client.close());
  assert.equal(client.pending.size, 0);
});

test('close does not close an already closed socket', () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  let closeCalled = false;

  client.socket = {
    readyState: 3,
    close() {
      closeCalled = true;
    },
  };

  client.close();

  assert.equal(closeCalled, false);
  assert.equal(client.socket, null);
  assert.equal(client.registered, false);
});

test('uses generic SSAP error when response has no error details', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  const request = client.request('ssap://audio/getVolume');
  const message = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: message.id,
    type: 'response',
    payload: {
      returnValue: false,
    },
  });

  await assert.rejects(request, /LG webOS request failed/);

  client.close();
});

test('subscription receives an empty payload when response payload is missing', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  let receivedPayload;

  await client.subscribe('ssap://audio/getVolume', (payload) => {
    receivedPayload = payload;
  });

  const subscribeMessage = JSON.parse(socket.sent.at(-1));

  socket.message({
    id: subscribeMessage.id,
    type: 'response',
  });

  assert.deepEqual(receivedPayload, {});

  client.close();
});

test('ignores websocket error after connection is already established', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  assert.doesNotThrow(() => {
    socket.error();
  });

  assert.equal(client.registered, true);

  client.close();
});

test('falls back to generic connection error when no URL is available', async () => {
  class ClientWithoutUrls extends WebOsClient {
    get urls() {
      return [];
    }
  }

  const client = new ClientWithoutUrls({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await assert.rejects(client.connect(), /Unable to connect to LG webOS TV/);
});

test('subscription tolerates a missing callback on a successful response', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  await client.subscribe('ssap://audio/getVolume', undefined);

  const subscribeMessage = JSON.parse(socket.sent.at(-1));

  assert.doesNotThrow(() => {
    socket.message({
      id: subscribeMessage.id,
      type: 'response',
      payload: {
        volume: 12,
      },
    });
  });

  client.close();
});

test('subscription tolerates a missing callback on an error response', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  const socket = FakeWebSocket.instances[0];

  await client.subscribe('ssap://audio/getVolume', undefined);

  const subscribeMessage = JSON.parse(socket.sent.at(-1));

  assert.doesNotThrow(() => {
    socket.message({
      id: subscribeMessage.id,
      type: 'error',
      error: 'subscription failed',
      payload: {
        returnValue: false,
      },
    });
  });

  client.close();
});

test('uses request type in timeout error when URI is empty', async () => {
  FakeWebSocket.reset(registeredScenario());

  const client = new WebOsClient({
    ip: '192.168.1.20',
    timeout: 5,
    WebSocketImpl: FakeWebSocket,
  });

  await client.connect();

  await assert.rejects(client.request(''), /LG webOS request timed out: request/);

  client.close();
});

test('ignores a second registration response after connection is already settled', async () => {
  FakeWebSocket.reset({
    onCreate(socket) {
      socket.open();
    },

    onSend(socket, message) {
      if (message.type !== 'register') return;

      queueMicrotask(() => {
        socket.message({
          id: message.id,
          type: 'registered',
          payload: {
            'client-key': 'first-key',
          },
        });

        socket.message({
          id: message.id,
          type: 'registered',
          payload: {
            'client-key': 'second-key',
          },
        });
      });
    },
  });

  const client = new WebOsClient({
    ip: '192.168.1.20',
    WebSocketImpl: FakeWebSocket,
  });

  const registered = [];

  client.on('registered', (clientKey) => {
    registered.push(clientKey);
  });

  await client.connect();

  assert.equal(client.clientKey, 'second-key');
  assert.deepEqual(registered, ['first-key', 'second-key']);

  client.close();
});

test('uses the global WebSocket implementation by default', () => {
  const client = new WebOsClient({
    ip: '192.168.1.20',
  });

  assert.equal(client.WebSocketImpl, globalThis.WebSocket);
});