import { db } from '../db';

export interface SyncNotification {
  id: string;
  type: 'success' | 'info' | 'warning';
  message: string;
}

type SyncListener = (notification: SyncNotification) => void;

class SyncManager {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notify({
          id: `online-${Date.now()}`,
          type: 'info',
          message: '✨ Internet connection detected. Checking local submissions to sync...',
        });
        this.syncOutbox();
      });

      // Periodic check every 30 seconds
      setInterval(() => {
        if (navigator.onLine) {
          this.syncOutbox();
        }
      }, 30000);
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(notification: SyncNotification) {
    this.listeners.forEach((fn) => fn(notification));
  }

  public async syncOutbox(): Promise<{ syncedCount: number }> {
    if (this.isSyncing || !navigator.onLine) {
      return { syncedCount: 0 };
    }

    try {
      this.isSyncing = true;
      const pendingItems = await db.outbox.filter((item) => !item.synced).toArray();

      if (pendingItems.length === 0) {
        return { syncedCount: 0 };
      }

      console.log(`[SyncManager] Found ${pendingItems.length} unsynced items in IndexedDB outbox. Syncing to server...`);

      const token = typeof window !== 'undefined' ? localStorage.getItem('sentri_auth_token') : null;
      const response = await fetch('/api/submissions/sync-outbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: pendingItems }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const syncedIds: string[] = data.syncedIds || [];

      // Mark outbox records as synced and update submission records
      for (const item of pendingItems) {
        if (syncedIds.includes(item.submissionId)) {
          if (item.id) {
            await db.outbox.update(item.id, { synced: true });
          }
          await db.submissions.update(item.submissionId, { status: 'synced' });
        }
      }

      if (syncedIds.length > 0) {
        this.notify({
          id: `synced-${Date.now()}`,
          type: 'success',
          message: `✨ Connection restored. ${syncedIds.length} local submission(s) safely synced to server.`,
        });
      }

      return { syncedCount: syncedIds.length };
    } catch (err: any) {
      console.warn('[SyncManager] Sync attempt deferred:', err.message);
      return { syncedCount: 0 };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncManager = new SyncManager();
