'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CourseAccordion from './CourseAccordion';
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
  // Escape key listener — same pattern as ColorPicker.tsx
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 bg-[--color-surface] border-l border-[--color-border] overflow-y-auto shadow-2xl transition-transform duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[--color-border]">
          <span className="text-sm font-semibold text-[--color-text-primary]">{courseName}</span>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="text-[--color-text-secondary] hover:text-[--color-text-primary] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <CourseAccordion
            courseName={courseName}
            colorId={colorId}
            enabled={enabled}
            events={events}
            courseTypeSettings={courseTypeSettings}
            onToggleCourse={onToggleCourse}
            onToggleEvent={onToggleEvent}
            onChangeColor={onChangeColor}
            onToggleEventType={onToggleEventType}
            onChangeEventTypeColor={onChangeEventTypeColor}
          />
        </div>
      </div>
    </>,
    document.body
  );
}
