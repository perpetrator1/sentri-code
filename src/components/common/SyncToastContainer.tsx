import React, { useEffect, useState } from 'react';
import { syncManager, type SyncNotification } from '../../services/syncManager';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const SyncToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<SyncNotification[]>([]);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((notif) => {
      setToasts((prev) => [...prev, notif]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== notif.id));
      }, 5000);
    });

    return () => unsubscribe();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast toast-bottom toast-end z-50 p-4 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`alert ${
            t.type === 'success'
              ? 'alert-success text-success-content'
              : t.type === 'warning'
              ? 'alert-warning text-warning-content'
              : 'alert-info text-info-content'
          } shadow-lg py-2.5 px-3.5 text-xs flex items-center justify-between rounded-xl transition-all duration-300`}
        >
          <div className="flex items-center gap-2">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="font-medium leading-relaxed">{t.message}</span>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="btn btn-ghost btn-xs btn-circle shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
