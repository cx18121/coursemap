'use client';

interface SyncProgress {
  courseName: string;
  processed: number;
  total: number;
}

type SyncStatus = 'idle' | 'running' | 'complete' | 'error';

interface SyncButtonProps {
  onSync: () => Promise<string>;
  syncStatus: SyncStatus;
  progress: SyncProgress[];
  syncError: string | null;
  disabled: boolean;
  inline?: boolean;
}

export default function SyncButton({ onSync, syncStatus, progress, syncError, disabled, inline }: SyncButtonProps) {
  const totalProcessed = progress.reduce((sum, p) => sum + p.processed, 0);
  const totalEvents = progress.reduce((sum, p) => sum + p.total, 0);
  const progressPercent = totalEvents > 0 ? Math.round((totalProcessed / totalEvents) * 100) : 0;

  const isRunning = syncStatus === 'running';
  const isError = syncStatus === 'error';

  const content = (
    <>
      {/* Error message */}
      {isError && syncError && (
        <p className="text-sm text-red-400 mb-2 text-center">{syncError}</p>
      )}

      {/* Sync button or progress bar */}
      {isRunning ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[--color-text-secondary]">
            <span>Syncing…</span>
            <span>
              {totalProcessed}/{totalEvents} events
            </span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={onSync}
          disabled={disabled}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            disabled
              ? 'bg-white/10 text-[--color-text-secondary] cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]'
          }`}
        >
          {isError ? 'Retry Sync' : 'Sync Now'}
        </button>
      )}
    </>
  );

  if (inline) {
    return (
      <div className="rounded-xl overflow-hidden border border-[--color-border] bg-white/5 p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-[--color-surface]/80 backdrop-blur-xl border-t border-[--color-border]">
      <div className="max-w-2xl mx-auto">
        {content}
      </div>
    </div>
  );
}
