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
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export default function EventRow({
  uid,
  cleanedTitle,
  description,
  start,
  excluded,
  onToggle,
}: EventRowProps) {
  const included = !excluded;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors ml-4">
      <input
        type="checkbox"
        checked={included}
        onChange={() => onToggle(uid, included)}
        className="mt-1 w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
        aria-label={`Include "${cleanedTitle}"`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-snug ${
            included ? 'text-[--color-text-primary]' : 'text-[--color-text-secondary] line-through'
          }`}
        >
          {cleanedTitle}
        </p>
        <p className="text-xs text-[--color-text-secondary] mt-1">{formatDate(start)}</p>
      </div>
    </div>
  );
}
