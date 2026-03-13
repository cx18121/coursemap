'use client';

interface SchoolCalendar {
  calendarId: string;
  name: string;
  selected: boolean;
}

interface SchoolCalendarListProps {
  calendars: SchoolCalendar[];
  onToggle: (calendarId: string, calendarName: string, enabled: boolean) => void;
}

export default function SchoolCalendarList({ calendars, onToggle }: SchoolCalendarListProps) {
  if (calendars.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4">
        <p className="text-sm text-[--color-text-secondary]">No calendars found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] divide-y divide-[--color-border]">
      {calendars.map((cal) => (
        <label
          key={cal.calendarId}
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
        >
          <input
            type="checkbox"
            checked={cal.selected}
            onChange={() => onToggle(cal.calendarId, cal.name, !cal.selected)}
            className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
          />
          <span className="text-sm text-[--color-text-primary]">{cal.name}</span>
        </label>
      ))}
    </div>
  );
}
