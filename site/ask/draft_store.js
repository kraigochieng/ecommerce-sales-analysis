// Keeps the text of the question in browser storage, so a reload does not lose it.
// The key is never saved here. Side effect: reads and writes the storage that comes in.

const DEFAULT_STORAGE_KEY = "ask-question-draft";

/**
 * @typedef {object} DraftStore
 * @property {() => string} load  Returns the saved text, or an empty string.
 * @property {(options: { text: string }) => boolean} save  Returns false when the browser blocks storage.
 * @property {() => boolean} clear  Returns false when the browser blocks storage.
 */

/**
 * Creates a store for the draft of the question.
 * @param {{ storage: Storage | undefined, storageKey?: string }} options
 * @returns {DraftStore}
 */
export function createDraftStore({ storage, storageKey = DEFAULT_STORAGE_KEY }) {
  /** Runs one storage action. Returns false when the storage is missing or blocked. */
  function attempt({ action }) {
    try {
      action();
      return true;
    } catch {
      return false;
    }
  }

  return {
    load() {
      try {
        return storage?.getItem(storageKey) ?? "";
      } catch {
        return "";
      }
    },
    save({ text }) {
      return storage !== undefined && attempt({ action: () => storage.setItem(storageKey, text) });
    },
    clear() {
      return storage !== undefined && attempt({ action: () => storage.removeItem(storageKey) });
    },
  };
}
