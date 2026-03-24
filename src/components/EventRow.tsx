'use client';

interface EventRowProps {
  uid: string;
  cleanedTitle: string;
  originalTitle: string;
  description: string;
  start: string;
  end: string;
  excluded: boolean;
  onToggle: (uid: string, excluded: boolean) => void;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventRow({
  uid,
  cleanedTitle,
  start,
  excluded,
  onToggle,
}: EventRowProps) {
  const included = !excluded;

  return (
    <label className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-[--color-surface-raised] active:bg-[--color-border]/40 transition-colors ml-4 cursor-pointer">
      <input
        type="checkbox"
        checked={included}
        onChange={() => onToggle(uid, included)}
        className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0 cursor-pointer"
        aria-label={`Include "${cleanedTitle}"`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${
            included ? 'text-[--color-text-primary]' : 'text-[--color-text-tertiary] line-through'
          }`}
        >
          {cleanedTitle}
        </p>
        <p className="text-xs text-[--color-text-tertiary] mt-0.5">{formatDate(start)}</p>
      </div>
    </label>
  );
}
