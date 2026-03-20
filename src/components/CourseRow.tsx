'use client';

import { GOOGLE_CALENDAR_COLORS } from './ColorPicker';

interface CourseRowProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  eventCount: number;
  onClick: () => void;
  onToggle: (courseName: string, enabled: boolean) => void;
}

export default function CourseRow({
  courseName,
  colorId,
  enabled,
  eventCount,
  onClick,
  onToggle,
}: CourseRowProps) {
  const colorHex = GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#4285f4';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="flex items-center gap-3 px-3 h-11 rounded-xl cursor-pointer hover:bg-white/[0.08] transition-colors border border-transparent hover:border-[--color-border]"
    >
      {/* Color swatch */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: colorHex }}
        aria-hidden="true"
      />

      {/* Course name — truncate long names */}
      <span className="flex-1 text-sm text-[--color-text-primary] truncate min-w-0">
        {courseName}
      </span>

      {/* Event count badge */}
      <span className="text-xs text-[--color-text-secondary] flex-shrink-0 tabular-nums">
        {eventCount}
      </span>

      {/* Enabled toggle — stopPropagation prevents row onClick */}
      <input
        type="checkbox"
        checked={enabled}
        aria-label={`Enable ${courseName}`}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(courseName, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded accent-indigo-500 cursor-pointer flex-shrink-0"
      />
    </div>
  );
}
