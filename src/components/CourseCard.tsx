'use client';

import { GOOGLE_CALENDAR_COLORS } from './ColorPicker';

interface CourseCardProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  eventCount: number;
  onClick: () => void;
  onToggle: (courseName: string, enabled: boolean) => void;
}

export default function CourseCard({ courseName, colorId, enabled, eventCount, onClick, onToggle }: CourseCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4 cursor-pointer hover:bg-white/[0.15] transition-colors space-y-3"
    >
      {/* Top row: color swatch left, checkbox right */}
      <div className="flex items-center justify-between">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#4285f4' }}
        />
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            e.stopPropagation();
            onToggle(courseName, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
        />
      </div>

      {/* Course name */}
      <p className="text-sm font-medium text-[--color-text-primary] line-clamp-2">{courseName}</p>

      {/* Event count */}
      <p className="text-xs text-[--color-text-secondary]">{eventCount} events</p>
    </div>
  );
}
