// Scan-file cache for the new-case flow.
//
// A picked File can't survive a page refresh, so the scan is stashed here when
// the upload lands and restored when the user comes back to an in-progress
// case. It is cleared once the superimpose step finishes — the scan is on the
// server by then and the cached copy is dead weight.
//
// Storage is IndexedDB rather than sessionStorage: the uploader accepts files
// up to 500 MB, while sessionStorage caps out around 5 MB per origin and only
// holds strings (base64 inflates a blob by a third on top of that), so real
// intraoral scans could never fit. IndexedDB stores the Blob as-is.
//
// Session lifetime is preserved on top of IndexedDB — which is otherwise
// persistent — by tagging every entry with a session id held in sessionStorage
// and sweeping entries from other sessions the first time the cache is touched.
// sessionStorage is per-tab, so "another session" also means "another open
// tab"; the sweep therefore only drops foreign entries once they're past a TTL,
// so a second tab can't delete a scan the first one is still working with.

const DB_NAME = 'mpf-scan-cache';
const DB_VERSION = 1;
const STORE = 'scans';
const SESSION_KEY = 'mpf-scan-session';

// Matches the uploader's own limit in EmployeeNewCase.
const MAX_CACHE_SIZE = 500 * 1024 * 1024;

// How long an entry belonging to another session may survive before the sweep
// treats it as abandoned rather than as a sibling tab's live work.
const STALE_TTL_MS = 12 * 60 * 60 * 1000;

// The id for the current browser session. Lives in sessionStorage, so it dies
// with the tab and a later session gets a fresh one — which is what makes the
// stale-entry purge below able to tell "this session" from "a previous one".
function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

function runTx(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try {
      result = work(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result?.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Drop entries left behind by sessions that are gone. Runs once per page load,
// lazily, so the cost is paid on the first cache access rather than on import.
// Entries from another session are only dropped once they're past STALE_TTL_MS
// — before that they may belong to a sibling tab that is still using them.
let purged = null;
function purgeStaleSessions(db) {
  if (purged) return purged;
  const current = sessionId();
  const cutoff = Date.now() - STALE_TTL_MS;
  purged = new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const entry = cursor.value;
      const foreign = !current || entry?.sessionId !== current;
      if (foreign && !(entry?.createdAt > cutoff)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  return purged;
}

async function withStore(mode, work) {
  const db = await openDb();
  try {
    await purgeStaleSessions(db);
    return await runTx(db, mode, work);
  } finally {
    db.close();
  }
}

export async function cacheScanFile(caseId, file) {
  if (!caseId || !file) return false;
  if (file.size > MAX_CACHE_SIZE) return false;

  try {
    await withStore('readwrite', (store) =>
      store.put(
        {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          blob: file,
          sessionId: sessionId(),
          createdAt: Date.now(),
        },
        String(caseId),
      ),
    );
    return true;
  } catch {
    // Quota exceeded, private-mode restrictions, no IndexedDB — the cache is a
    // convenience, so a failure here just means no refresh-resume.
    return false;
  }
}

export async function getCachedScanFile(caseId) {
  if (!caseId) return null;

  try {
    const entry = await withStore('readonly', (store) => store.get(String(caseId)));
    if (!entry?.blob) return null;
    return new File([entry.blob], entry.name, { type: entry.type });
  } catch {
    clearCachedScanFile(caseId);
    return null;
  }
}

export async function clearCachedScanFile(caseId) {
  if (!caseId) return;
  try {
    await withStore('readwrite', (store) => store.delete(String(caseId)));
  } catch {
    // silently ignore
  }
}
