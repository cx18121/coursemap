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
      <div className="bg-white rounded-lg border border-[--color-border] p-4">
        <p className="text-sm text-[--color-text-secondary]">No calendars found in your school account.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
      {calendars.map((cal) => (
        <label
          key={cal.calendarId}
          className="flex items-center gap-3 px-3 py-3 md:py-2.5 cursor-pointer hover:bg-[--color-surface-raised] transition-colors first:rounded-t-lg last:rounded-b-lg"
        >
          <input
            type="checkbox"
            checked={cal.selected}
            onChange={() => onToggle(cal.calendarId, cal.name, !cal.selected)}
            className="w-4 h-4 rounded accent-amber-500 flex-shrink-0 cursor-pointer"
          />
          <span className="text-sm text-[--color-text-primary] truncate min-w-0">{cal.name}</span>
        </label>
      ))}
    </div>
  );
}
