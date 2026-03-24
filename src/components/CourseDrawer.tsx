'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CourseAccordion from './CourseAccordion';
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

interface CourseDrawerProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  events: CourseEvent[];
  courseTypeSettings: CourseTypeSetting[];
  onClose: () => void;
  onToggleCourse: (courseName: string, enabled: boolean) => void;
  onToggleEvent: (uid: string, excluded: boolean) => void;
  onChangeColor: (courseName: string, colorId: string) => void;
  onToggleEventType: (courseName: string, eventType: string, enabled: boolean) => void;
  onChangeEventTypeColor: (courseName: string, eventType: string, colorId: string) => void;
}

export default function CourseDrawer({
  courseName,
  colorId,
  enabled,
  events,
  courseTypeSettings,
  onClose,
  onToggleCourse,
  onToggleEvent,
  onChangeColor,
  onToggleEventType,
  onChangeEventTypeColor,
}: CourseDrawerProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const colorDotRef = useRef<HTMLButtonElement>(null);
  const colorHex = GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#3F51B5';
  const includedCount = events.filter((e) => !e.excluded).length;

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(), 175);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Course settings: ${courseName}`}
      className={`fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white border-l border-[--color-border] shadow-xl shadow-black/6 flex flex-col ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[--color-border] flex-shrink-0">
        {/* Enable/disable checkbox */}
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => onToggleCourse(courseName, !enabled)}
          className="w-4 h-4 rounded accent-amber-500 flex-shrink-0 cursor-pointer"
          aria-label={`Enable course "${courseName}"`}
        />

        {/* Color dot */}
        <div className="relative flex-shrink-0">
          <button
            ref={colorDotRef}
            onClick={() => setShowColorPicker((v) => !v)}
            className="w-5 h-5 rounded-full border-2 border-white/60 hover:border-white transition-colors focus:outline-none shadow-sm"
            style={{ backgroundColor: colorHex }}
            aria-label={`Change color for "${courseName}"`}
            title="Change color"
          />
          {showColorPicker && (
            <ColorPicker
              anchorRef={colorDotRef}
              currentColorId={colorId}
              onSelect={(id) => { onChangeColor(courseName, id); setShowColorPicker(false); }}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        {/* Course name + count */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-[--color-text-primary] truncate">{courseName}</p>
          <p className="text-xs text-[--color-text-secondary]">{includedCount} of {events.length} events included</p>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close drawer"
          className="p-2.5 -mr-1 rounded-lg text-[--color-text-tertiary] hover:text-[--color-text-primary] hover:bg-[--color-surface-raised] transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <CourseAccordion
          courseName={courseName}
          colorId={colorId}
          enabled={enabled}
          events={events}
          courseTypeSettings={courseTypeSettings}
          defaultExpanded={true}
          hideHeader={true}
          onToggleCourse={onToggleCourse}
          onToggleEvent={onToggleEvent}
          onChangeColor={onChangeColor}
          onToggleEventType={onToggleEventType}
          onChangeEventTypeColor={onChangeEventTypeColor}
        />
      </div>
    </div>,
    document.body
  );
}
