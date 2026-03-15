'use client';

interface TypeGroupingToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function TypeGroupingToggle({ enabled, onToggle }: TypeGroupingToggleProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4">
      <div className="flex items-center gap-3 min-h-[44px]">
        <input
          type="checkbox"
          id="type-grouping-toggle"
          aria-label="Enable event type grouping"
          className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <label htmlFor="type-grouping-toggle" className="flex-1 cursor-pointer">
          <span className="text-sm font-medium text-[--color-text-primary]">
            Group events by type
          </span>
          <p className="text-xs text-[--color-text-secondary] mt-0.5">
            Creates separate sub-calendars for Assignments, Quizzes, Discussions, and other events within each course.
          </p>
          <div className="flex gap-1.5 flex-wrap mt-1" aria-hidden="true">
            {['Assignments', 'Quizzes', 'Discussions', 'Events'].map((label) => (
              <span
                key={label}
                className={`text-xs rounded-full px-2 py-0.5 bg-white/10 ${
                  enabled ? 'text-[--color-text-secondary]' : 'text-[--color-text-tertiary]'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </label>
      </div>
    </div>
  );
}
