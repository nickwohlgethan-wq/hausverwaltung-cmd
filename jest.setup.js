// jest-expo stellt für native Module nur leere Attrappen bereit; expo-crypto ersetzen wir durch Node-Crypto.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytes: (n) => new Uint8Array(nodeCrypto.randomBytes(n)),
  };
});
