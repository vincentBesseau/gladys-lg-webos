import test from 'node:test';
import assert from 'node:assert/strict';
import { WebOsClient } from '../src/webos/client.js';

class FakeWebSocket {
  static OPEN = 1;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open', {});
    });
  }
  addEventListener(name, callback) {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
  }
  emit(name, event) {
    for (const callback of this.listeners.get(name) ?? []) callback(event);
  }
  send(raw) {
    this.sent.push(raw);
    const message = JSON.parse(raw);
    if (message.type === 'register') {
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ id: message.id, type: 'registered', payload: { 'client-key': 'abc' } }) }));
    } else if (message.type === 'request') {
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ id: message.id, type: 'response', payload: { returnValue: true } }) }));
    }
  }
  close() {
    this.readyState = 3;
    this.emit('close', {});
  }
}

test('registers then sends SSAP requests', async () => {
  const client = new WebOsClient({ ip: '192.168.1.20', WebSocketImpl: FakeWebSocket });
  await client.connect();
  assert.equal(client.clientKey, 'abc');
  assert.equal(client.connectedUrl, 'ws://192.168.1.20:3000');
  const response = await client.request('ssap://audio/getVolume');
  assert.equal(response.returnValue, true);
  client.close();
});
