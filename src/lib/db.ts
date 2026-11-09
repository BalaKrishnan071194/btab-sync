/**
 * IndexedDB Module for bTab Sync
 *
 * Provides persistent storage for:
 * - workspaces: Saved tab collections
 * - tabHistory: Recently closed tabs (100 max, 30 day expiry)
 * - notes: Quick notes attached to URLs
 * - reminders: Tab reminders with alarm integration
 */

// ============================================================================
// Types
// ============================================================================

/** Workspace data structure */
export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly type: 'default' | 'project';
  readonly emoji?: string;
  readonly color?: string;
  readonly tabs: readonly WorkspaceTab[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Tab data stored in a workspace */
export interface WorkspaceTab {
  readonly url: string;
  readonly title: string;
  readonly favIconUrl: string;
  readonly pinned: boolean;
}

/** Tab history entry */
export interface TabHistoryEntry {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly favIconUrl: string;
  readonly closedAt: number;
  readonly sessionType?: 'normal' | 'recording';
  readonly sessionId?: string;
}

/** Quick note attached to a URL */
export interface QuickNote {
  readonly id: string;
  readonly url: string;
  readonly normalizedUrl: string;
  readonly content: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Tab reminder */
export interface TabReminder {
  readonly id: string;
  readonly tabId?: number;
  readonly url: string;
  readonly title: string;
  readonly remindAt: number;
  readonly message?: string;
  readonly createdAt: number;
  readonly fired: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'btab-sync-db';
const DB_VERSION = 1;
const MAX_HISTORY_ENTRIES = 100;
const HISTORY_EXPIRY_DAYS = 30;

// ============================================================================
// Database Manager
// ============================================================================

class Database {
  private _db: IDBDatabase | null = null;
  private _openPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open the IndexedDB database
   */
  async open(): Promise<IDBDatabase> {
    if (this._db) return this._db;
    if (this._openPromise) return this._openPromise;

    this._openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[bTab DB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create workspaces store
        if (!db.objectStoreNames.contains('workspaces')) {
          const workspacesStore = db.createObjectStore('workspaces', { keyPath: 'id' });
          workspacesStore.createIndex('name', 'name', { unique: false });
          workspacesStore.createIndex('type', 'type', { unique: false });
          workspacesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create tabHistory store
        if (!db.objectStoreNames.contains('tabHistory')) {
          const historyStore = db.createObjectStore('tabHistory', { keyPath: 'id' });
          historyStore.createIndex('url', 'url', { unique: false });
          historyStore.createIndex('closedAt', 'closedAt', { unique: false });
          historyStore.createIndex('sessionId', 'sessionId', { unique: false });
        }

        // Create notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('normalizedUrl', 'normalizedUrl', { unique: true });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create reminders store
        if (!db.objectStoreNames.contains('reminders')) {
          const remindersStore = db.createObjectStore('reminders', { keyPath: 'id' });
          remindersStore.createIndex('remindAt', 'remindAt', { unique: false });
          remindersStore.createIndex('fired', 'fired', { unique: false });
          remindersStore.createIndex('url', 'url', { unique: false });
        }
      };
    });

    return this._openPromise;
  }

  /**
   * Save or update an object in a store
   */
  async save<T extends { id: string }>(storeName: string, obj: T): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(obj);

      request.onsuccess = () => resolve(obj);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get an object by ID
   */
  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all objects from a store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get objects by index value
   */
  async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an object by ID
   */
  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all objects from a store
   */
  async clear(storeName: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count objects in a store
   */
  async count(storeName: string): Promise<number> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const DB = new Database();

// ============================================================================
// Workspace Operations
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Save a workspace
 */
export async function saveWorkspace(workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workspace> {
  const now = Date.now();
  const ws: Workspace = {
    ...workspace,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  return DB.save('workspaces', ws);
}

/**
 * Update a workspace
 */
export async function updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace | undefined> {
  const existing = await DB.get<Workspace>('workspaces', id);
  if (!existing) return undefined;

  const updated: Workspace = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  return DB.save('workspaces', updated);
}

/**
 * Get all workspaces
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  return DB.getAll<Workspace>('workspaces');
}

/**
 * Get a workspace by ID
 */
export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  return DB.get<Workspace>('workspaces', id);
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(id: string): Promise<void> {
  return DB.delete('workspaces', id);
}

// ============================================================================
// Tab History Operations
// ============================================================================

/**
 * Normalize URL for consistent lookups
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/**
 * Record a closed tab in history
 */
export async function recordClosedTab(entry: Omit<TabHistoryEntry, 'id'>): Promise<TabHistoryEntry> {
  const historyEntry: TabHistoryEntry = {
    ...entry,
    id: generateId(),
  };

  await DB.save('tabHistory', historyEntry);

  // Prune old entries
  await pruneTabHistory();

  return historyEntry;
}

/**
 * Prune tab history (keep max 100, remove older than 30 days)
 */
export async function pruneTabHistory(): Promise<void> {
  const allEntries = await DB.getAll<TabHistoryEntry>('tabHistory');
  const cutoff = Date.now() - HISTORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

  // Sort by closedAt descending
  allEntries.sort((a, b) => b.closedAt - a.closedAt);

  // Delete expired and excess entries
  const toDelete: string[] = [];
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    if (!entry) continue;
    if (entry.closedAt < cutoff || i >= MAX_HISTORY_ENTRIES) {
      toDelete.push(entry.id);
    }
  }

  for (const id of toDelete) {
    await DB.delete('tabHistory', id);
  }
}

/**
 * Get tab history entries, grouped by date
 */
export async function getTabHistory(): Promise<TabHistoryEntry[]> {
  const entries = await DB.getAll<TabHistoryEntry>('tabHistory');
  // Sort by closedAt descending
  return entries.sort((a, b) => b.closedAt - a.closedAt);
}

/**
 * Search tab history
 */
export async function searchTabHistory(query: string): Promise<TabHistoryEntry[]> {
  const entries = await getTabHistory();
  const lowerQuery = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.title.toLowerCase().includes(lowerQuery) ||
      e.url.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Clear tab history
 */
export async function clearTabHistory(): Promise<void> {
  return DB.clear('tabHistory');
}

// ============================================================================
// Quick Notes Operations
// ============================================================================

/**
 * Save or update a note for a URL
 */
export async function saveNote(url: string, content: string): Promise<QuickNote> {
  const normalizedUrl = normalizeUrl(url);
  const existing = await getNoteByUrl(normalizedUrl);
  const now = Date.now();

  if (existing) {
    const updated: QuickNote = {
      ...existing,
      content,
      updatedAt: now,
    };
    return DB.save('notes', updated);
  }

  const note: QuickNote = {
    id: generateId(),
    url,
    normalizedUrl,
    content,
    createdAt: now,
    updatedAt: now,
  };
  return DB.save('notes', note);
}

/**
 * Get note by URL
 */
export async function getNoteByUrl(url: string): Promise<QuickNote | undefined> {
  const normalizedUrl = normalizeUrl(url);
  const notes = await DB.getByIndex<QuickNote>('notes', 'normalizedUrl', normalizedUrl);
  return notes[0];
}

/**
 * Get all notes
 */
export async function getAllNotes(): Promise<QuickNote[]> {
  return DB.getAll<QuickNote>('notes');
}

/**
 * Delete a note
 */
export async function deleteNote(id: string): Promise<void> {
  return DB.delete('notes', id);
}

// ============================================================================
// Reminders Operations
// ============================================================================

/**
 * Create a reminder
 */
export async function createReminder(reminder: Omit<TabReminder, 'id' | 'createdAt' | 'fired'>): Promise<TabReminder> {
  const r: TabReminder = {
    ...reminder,
    id: generateId(),
    createdAt: Date.now(),
    fired: false,
  };
  return DB.save('reminders', r);
}

/**
 * Get pending reminders (not fired, due before cutoff time)
 */
export async function getPendingReminders(beforeTime?: number): Promise<TabReminder[]> {
  const all = await DB.getAll<TabReminder>('reminders');
  const cutoff = beforeTime ?? Date.now();
  return all.filter((r) => !r.fired && r.remindAt <= cutoff);
}

/**
 * Get all reminders
 */
export async function getAllReminders(): Promise<TabReminder[]> {
  return DB.getAll<TabReminder>('reminders');
}

/**
 * Mark reminder as fired
 */
export async function markReminderFired(id: string): Promise<void> {
  const reminder = await DB.get<TabReminder>('reminders', id);
  if (reminder) {
    await DB.save('reminders', { ...reminder, fired: true });
  }
}

/**
 * Delete a reminder
 */
export async function deleteReminder(id: string): Promise<void> {
  return DB.delete('reminders', id);
}

/**
 * Clear fired reminders
 */
export async function clearFiredReminders(): Promise<void> {
  const all = await DB.getAll<TabReminder>('reminders');
  for (const r of all) {
    if (r.fired) {
      await DB.delete('reminders', r.id);
    }
  }
}

export default DB;
