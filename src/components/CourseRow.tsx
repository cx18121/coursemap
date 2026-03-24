'use client';

import { memo } from 'react';
import { GOOGLE_CALENDAR_COLORS } from './ColorPicker';

interface CourseRowProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  eventCount: number;
  onOpen: (courseName: string) => void;
  onToggle: (courseName: string, enabled: boolean) => void;
}

const CourseRow = memo(function CourseRow({
  courseName,
  colorId,
  enabled,
  eventCount,
  onOpen,
  onToggle,
}: CourseRowProps) {
  const colorHex = GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#4285f4';

  return (
    <div
      onClick={() => onOpen(courseName)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(courseName); }}
      className="flex items-center gap-3 px-3 h-11 rounded-lg cursor-pointer hover:bg-[--color-surface-raised] active:bg-[--color-border]/40 transition-colors border border-transparent hover:border-[--color-border]"
    >
      {/* Color swatch — grayscale when course is disabled */}
      <div
        className={`w-3.5 h-3.5 rounded-full flex-shrink-0 transition-[filter] duration-200 ${enabled ? '' : 'grayscale opacity-30'}`}
        style={{ backgroundColor: colorHex }}
        aria-hidden="true"
      />

      {/* Course name — dims when disabled */}
      <span className={`flex-1 text-sm truncate min-w-0 transition-colors duration-200 ${
        enabled ? 'text-[--color-text-primary]' : 'text-[--color-text-tertiary]'
      }`}>
        {courseName}
      </span>

      {/* Event count badge */}
      <span className={`text-xs flex-shrink-0 tabular-nums transition-colors duration-200 ${
        enabled ? 'text-[--color-text-tertiary]' : 'text-[--color-border]'
      }`}>
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
        className="w-4 h-4 rounded accent-amber-500 cursor-pointer flex-shrink-0"
      />
    </div>
  );
});

export default CourseRow;
