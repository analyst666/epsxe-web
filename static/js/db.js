/* IndexedDB minimalista: games, bios, autosaves, profiles */
const DB_NAME = "epsxe-web";
const STORES = ["games", "bios", "autosaves", "kv"];
let _db;

function open() {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _db;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  put: (store, key, value) => tx(store, "readwrite", (s) => s.put(value, key)),
  get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
  del: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
  async all(store) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const out = [];
      const req = d.transaction(store, "readonly").objectStore(store).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

export async function storageEstimate() {
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 0 };
  } catch { return { usage: 0, quota: 0 }; }
}

export async function persist() {
  try { return await navigator.storage.persist(); } catch { return false; }
}
