'use client';

export interface EventTypeSettings {
  syncAssignments: boolean;
  syncQuizzes: boolean;
  syncDiscussions: boolean;
  syncEvents: boolean;
}

interface TypeGroupingToggleProps {
  settings: EventTypeSettings;
  onToggle: (key: keyof EventTypeSettings, enabled: boolean) => void;
}

const EVENT_TYPES: { key: keyof EventTypeSettings; label: string }[] = [
  { key: 'syncAssignments', label: 'Assignments' },
  { key: 'syncQuizzes', label: 'Quizzes' },
  { key: 'syncDiscussions', label: 'Discussions' },
  { key: 'syncEvents', label: 'Events' },
];

export default function TypeGroupingToggle({ settings, onToggle }: TypeGroupingToggleProps) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4">
      <p className="text-sm font-medium text-[--color-text-primary] mb-3">
        Sync event types:
      </p>
      <div className="flex flex-col gap-2">
        {EVENT_TYPES.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-3 min-h-[44px] cursor-pointer"
          >
            <input
              type="checkbox"
              id={`event-type-${key}`}
              aria-label={`Sync ${label}`}
              className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
              checked={settings[key]}
              onChange={(e) => onToggle(key, e.target.checked)}
            />
            <span className="text-sm text-[--color-text-primary]">{label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-[--color-text-secondary] mt-3">
        Events are grouped into per-type sub-calendars: &ldquo;Canvas - CourseName — Assignments&rdquo; etc.
        Unchecked types are not synced.
      </p>
    </div>
  );
}
