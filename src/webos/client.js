import { EventEmitter } from 'node:events';
import { buildRegistrationPayload } from './registration.js';

const OPEN = 1;

export class WebOsClient extends EventEmitter {
  constructor({
    ip,
    clientKey = '',
    mode = 'auto',
    timeout = 15000,
    WebSocketImpl = globalThis.WebSocket,
  }) {
    super();
    if (!WebSocketImpl) throw new Error('A WebSocket implementation is required (Node.js 22+).');
    this.ip = ip;
    this.clientKey = clientKey;
    this.mode = mode;
    this.timeout = timeout;
    this.WebSocketImpl = WebSocketImpl;
    this.socket = null;
    this.connectedUrl = null;
    this.pending = new Map();
    this.counter = 0;
    this.registered = false;
  }

  get urls() {
    if (this.mode === 'ws') return [`ws://${this.ip}:3000`];
    if (this.mode === 'wss') return [`wss://${this.ip}:3001`];
    return [`ws://${this.ip}:3000`, `wss://${this.ip}:3001`];
  }

  async connect() {
    let lastError;
    for (const url of this.urls) {
      try {
        await this.#connectUrl(url);
        this.connectedUrl = url;
        return;
      } catch (error) {
        lastError = error;
        this.close();
      }
    }
    throw lastError ?? new Error('Unable to connect to LG webOS TV.');
  }

  close() {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject?.(new Error('LG webOS connection closed.'));
    }
    this.pending.clear();
    if (this.socket && this.socket.readyState <= OPEN) this.socket.close();
    this.socket = null;
    this.registered = false;
  }

  async request(uri, payload = {}) {
    this.#assertReady();
    return this.#send('request', uri, payload, false);
  }

  async subscribe(uri, callback, payload = {}) {
    this.#assertReady();
    const id = this.#nextId();
    const message = { id, type: 'subscribe', uri, payload };
    this.pending.set(id, { subscription: true, callback });
    this.socket.send(JSON.stringify(message));
    return () => this.pending.delete(id);
  }

  #assertReady() {
    if (!this.socket || this.socket.readyState !== OPEN || !this.registered) {
      throw new Error('LG webOS TV is not connected.');
    }
  }

  #nextId() {
    this.counter += 1;
    return `gladys_${Date.now()}_${this.counter}`;
  }

  #send(type, uri, payload, allowBeforeRegistration) {
    if (!allowBeforeRegistration) this.#assertReady();
    const id = this.#nextId();
    const message = { id, type, uri, payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LG webOS request timed out: ${uri || type}`));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer, subscription: false });
      this.socket.send(JSON.stringify(message));
    });
  }

  #connectUrl(url) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const socket = new this.WebSocketImpl(url);
      this.socket = socket;

      const connectionTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`LG webOS connection timed out: ${url}`));
      }, this.timeout);

      socket.addEventListener('open', () => {
        const id = this.#nextId();
        this.pending.set(id, {
          subscription: true,
          callback: (payload) => {
            if (payload?.['client-key']) {
              this.clientKey = payload['client-key'];
              this.registered = true;
              this.emit('registered', this.clientKey);
              if (!settled) {
                settled = true;
                clearTimeout(connectionTimer);
                resolve();
              }
            } else {
              this.emit('pairing');
            }
          },
        });
        socket.send(
          JSON.stringify({
            id,
            type: 'register',
            payload: buildRegistrationPayload(this.clientKey),
          }),
        );
      });

      socket.addEventListener('message', (event) => this.#handleMessage(event.data));
      socket.addEventListener('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(connectionTimer);
          reject(new Error(`LG webOS WebSocket error: ${url}`));
        }
      });
      socket.addEventListener('close', () => {
        this.registered = false;
        this.emit('close');
        if (!settled) {
          settled = true;
          clearTimeout(connectionTimer);
          reject(new Error(`LG webOS connection closed before pairing: ${url}`));
        }
      });
    });
  }

  #handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      this.emit('error', new Error('Invalid JSON received from LG webOS TV.'));
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;

    if (message.type === 'error' || message.payload?.returnValue === false) {
      if (!pending.subscription) {
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        pending.reject(
          new Error(message.error || message.payload?.errorText || 'LG webOS request failed.'),
        );
      } else {
        pending.callback?.(message.payload, message);
      }
      return;
    }

    if (pending.subscription) {
      pending.callback?.(message.payload ?? {}, message);
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    pending.resolve(message.payload ?? {});
  }
}
