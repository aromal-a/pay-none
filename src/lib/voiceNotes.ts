// Local-only voice note store (IndexedDB). Nothing leaves the browser.
const DB_NAME = "qt_voice_notes";
const STORE = "notes";
const VERSION = 1;

export interface VoiceNote {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: number;
  mimeType: string;
  size: number;
  durationMs: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("userId", "userId", { unique: false });
        s.createIndex("sessionId", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Per-tab session id so each capture series is grouped.
const SESSION_KEY = "qt_voice_session";
export function getSessionId(): string {
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

export async function saveVoiceNote(n: Omit<VoiceNote, "id" | "createdAt">): Promise<VoiceNote> {
  const full: VoiceNote = {
    ...n,
    id: `vn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(full);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return full;
}

export async function listVoiceNotes(userId: string): Promise<VoiceNote[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).index("userId").getAll(userId);
    req.onsuccess = () => {
      const out = (req.result as VoiceNote[]).sort((a, b) => b.createdAt - a.createdAt);
      db.close();
      resolve(out);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

// Token pricing: 1 token per 10 KB (rounded up), minimum 1.
export function tokensForBytes(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 10240));
}
