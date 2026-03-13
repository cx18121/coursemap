'use client';

import { useState } from 'react';
import EventRow from './EventRow';
import ColorPicker, { GOOGLE_CALENDAR_COLORS } from './ColorPicker';

interface CourseEvent {
  uid: string;
  summary: string;
  cleanedTitle: string;
  description: string;
  start: string;
  end: string;
  excluded: boolean;
}

interface CourseAccordionProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  events: CourseEvent[];
  onToggleCourse: (courseName: string, enabled: boolean) => void;
  onToggleEvent: (uid: string, excluded: boolean) => void;
  onChangeColor: (courseName: string, colorId: string) => void;
}

export default function CourseAccordion({
  courseName,
  colorId,
  enabled,
  events,
  onToggleCourse,
  onToggleEvent,
  onChangeColor,
}: CourseAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const includedCount = events.filter((e) => !e.excluded).length;
  const colorHex = GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#3F51B5';

  function handleCourseCheckbox() {
    onToggleCourse(courseName, !enabled);
  }

  function handleColorClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowColorPicker((v) => !v);
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] overflow-visible">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpanded((v) => !v)}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleCourseCheckbox}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
          aria-label={`Enable course "${courseName}"`}
        />

        {/* Color dot */}
        <div className="relative flex-shrink-0">
          <button
            onClick={handleColorClick}
            className="w-5 h-5 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors focus:outline-none"
            style={{ backgroundColor: colorHex }}
            aria-label={`Change color for "${courseName}"`}
            title="Change color"
          />
          {showColorPicker && (
            <ColorPicker
              currentColorId={colorId}
              onSelect={(id) => onChangeColor(courseName, id)}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        {/* Course name */}
        <span
          className={`flex-1 text-sm font-medium truncate ${
            enabled ? 'text-[--color-text-primary]' : 'text-[--color-text-secondary]'
          }`}
        >
          {courseName}
        </span>

        {/* Event count badge */}
        <span className="text-xs text-[--color-text-secondary] bg-white/10 rounded-full px-2 py-0.5 flex-shrink-0">
          {includedCount}/{events.length}
        </span>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-[--color-text-secondary] flex-shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expandable events list */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {events.length === 0 ? (
          <p className="text-sm text-[--color-text-secondary] px-4 pb-4">No events found.</p>
        ) : (
          <div className="px-2 pb-3 space-y-0.5 border-t border-[--color-border]">
            {events.map((event) => (
              <EventRow
                key={event.uid}
                uid={event.uid}
                cleanedTitle={event.cleanedTitle}
                originalTitle={event.summary}
                description={event.description}
                start={event.start}
                end={event.end}
                excluded={event.excluded}
                onToggle={onToggleEvent}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
