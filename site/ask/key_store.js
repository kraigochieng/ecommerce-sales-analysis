// Holds the OpenRouter key in memory only.
// The key never goes to storage, to a URL, to a log, or to a message.

/**
 * @typedef {object} KeyStore
 * @property {(options: { value: string }) => void} set  Keeps a new key.
 * @property {() => string} get  Returns the key, or an empty string.
 * @property {() => boolean} isSet  Tells whether a key is kept.
 * @property {() => void} clear  Forgets the key.
 */

/**
 * Creates a store whose key lives only in a closure.
 * Side effect: none. The closure is the only place that holds the key.
 * @returns {KeyStore}
 */
export function createKeyStore() {
  /** @type {string} */
  let keptKey = "";

  return Object.freeze({
    set({ value }) {
      keptKey = value.trim();
    },
    get() {
      return keptKey;
    },
    isSet() {
      return keptKey.length > 0;
    },
    clear() {
      keptKey = "";
    },
    toString() {
      return "[KeyStore]";
    },
    toJSON() {
      return "[KeyStore]";
    },
  });
}
