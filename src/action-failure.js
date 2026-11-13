// An Error whose `message` is a multi-language object ({ en, fr, de, ... }).
//
// The integration SDK relays a thrown error's `message` as-is to Gladys, and
// the frontend localizes it per user language exactly like a resolved success
// message. So throwing an ActionFailure gives a RED (error) toast that is also
// TRANSLATED — something a plain `throw new Error('text')` cannot do, since its
// message is a single string and onAction never receives the user language.
//
// Pattern suggested by @pierre-gilles (Gladys founder) on the community forum,
// already used by the ista and Renault integrations.
export class ActionFailure extends Error {
  constructor(message) {
    // Keep a readable string for logs and the stack trace.
    super(typeof message === 'string' ? message : message.en);

    // The actual payload relayed to Gladys: the multi-language object itself.
    this.message = message;
    this.name = 'ActionFailure';
  }
}
