'use client';

import { useRef, useState } from 'react';
import EventRow from './EventRow';
import ColorPicker, { GOOGLE_CALENDAR_COLORS } from './ColorPicker';
import type { CourseTypeSetting } from './TypeGroupingToggle';

interface CourseEvent {
  uid: string;
  summary: string;
  cleanedTitle: string;
  description: string;
  start: string;
  end: string;
  excluded: boolean;
  eventType: string;
}

interface CourseAccordionProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  events: CourseEvent[];
  courseTypeSettings: CourseTypeSetting[];
  defaultExpanded?: boolean;
  onToggleCourse: (courseName: string, enabled: boolean) => void;
  onToggleEvent: (uid: string, excluded: boolean) => void;
  onChangeColor: (courseName: string, colorId: string) => void;
  onToggleEventType: (courseName: string, eventType: string, enabled: boolean) => void;
  onChangeEventTypeColor: (courseName: string, eventType: string, colorId: string) => void;
}

export default function CourseAccordion({
  courseName,
  colorId,
  enabled,
  events,
  courseTypeSettings,
  defaultExpanded,
  onToggleCourse,
  onToggleEvent,
  onChangeColor,
  onToggleEventType,
  onChangeEventTypeColor,
}: CourseAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [openTypePickerKey, setOpenTypePickerKey] = useState<string | null>(null);
  const colorDotRef = useRef<HTMLButtonElement>(null);
  const typeSwatchRefs = useRef<Map<string, React.RefObject<HTMLButtonElement | null>>>(new Map());

  function getTypeSwatchRef(key: string): React.RefObject<HTMLButtonElement | null> {
    if (!typeSwatchRefs.current.has(key)) {
      typeSwatchRefs.current.set(key, { current: null });
    }
    return typeSwatchRefs.current.get(key)!;
  }

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
            ref={colorDotRef}
            onClick={handleColorClick}
            className="w-5 h-5 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors focus:outline-none"
            style={{ backgroundColor: colorHex }}
            aria-label={`Change color for "${courseName}"`}
            title="Change color"
          />
          {showColorPicker && (
            <ColorPicker
              anchorRef={colorDotRef}
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

      {/* Expandable section */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {/* Event type filters */}
        {courseTypeSettings.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-t border-[--color-border] space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[--color-text-secondary] mb-2">
              Event Types
            </p>
            {courseTypeSettings.map(({ eventType, enabled: typeEnabled, colorId: typeColorId }) => {
              const key = `${courseName}:${eventType}`;
              const swatchRef = getTypeSwatchRef(key);
              const typeColorHex = GOOGLE_CALENDAR_COLORS[typeColorId]?.hex ?? '#7986CB';
              return (
                <div key={key} className="flex items-center gap-3 min-h-[36px]">
                  <button
                    ref={swatchRef}
                    type="button"
                    aria-label={`Change color for ${eventType}`}
                    onClick={() => setOpenTypePickerKey(openTypePickerKey === key ? null : key)}
                    className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white/40"
                    style={{ backgroundColor: typeColorHex }}
                  />
                  {openTypePickerKey === key && (
                    <ColorPicker
                      anchorRef={swatchRef}
                      currentColorId={typeColorId}
                      onSelect={(newColorId) => {
                        onChangeEventTypeColor(courseName, eventType, newColorId);
                        setOpenTypePickerKey(null);
                      }}
                      onClose={() => setOpenTypePickerKey(null)}
                    />
                  )}
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={typeEnabled}
                      onChange={(e) => onToggleEventType(courseName, eventType, e.target.checked)}
                      className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
                      aria-label={`Sync ${eventType}`}
                    />
                    <span className="text-sm text-[--color-text-primary]">{eventType}</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {/* Individual events list */}
        {events.length === 0 ? (
          <p className="text-sm text-[--color-text-secondary] px-4 pb-4">No events found.</p>
        ) : (
          <div className="px-2 pb-3 space-y-0.5 border-t border-[--color-border]">
            {events.map((event) => {
              const typeSetting = courseTypeSettings.find((s) => s.eventType === event.eventType);
              const typeDisabled = typeSetting ? !typeSetting.enabled : false;
              return (
                <EventRow
                  key={event.uid}
                  uid={event.uid}
                  cleanedTitle={event.cleanedTitle}
                  originalTitle={event.summary}
                  description={event.description}
                  start={event.start}
                  end={event.end}
                  excluded={event.excluded || typeDisabled}
                  onToggle={onToggleEvent}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
