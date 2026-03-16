'use client';

import { useRef, useState } from 'react';
import ColorPicker, { GOOGLE_CALENDAR_COLORS } from './ColorPicker';

export interface CourseTypeSetting {
  courseName: string;
  eventType: string;
  enabled: boolean;
  colorId: string;
}

interface TypeGroupingToggleProps {
  courseTypeSettings: CourseTypeSetting[];
  onToggle: (courseName: string, eventType: string, enabled: boolean) => void;
  onColorChange: (courseName: string, eventType: string, colorId: string) => void;
}

/**
 * Groups per-course type settings by courseName and renders a section per course
 * with one row per discovered event type. Each row has a color swatch button and
 * an enable/disable checkbox.
 *
 * If no settings have been discovered yet (first sync hasn't run), shows a
 * prompt to run the first sync.
 */
export default function TypeGroupingToggle({ courseTypeSettings, onToggle, onColorChange }: TypeGroupingToggleProps) {
  // Track which (courseName:eventType) color picker is open, or null if none
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);

  // We keep one ref per row. Because the number of rows can change, we store
  // refs in a Map keyed by courseName:eventType.
  const swatchRefs = useRef<Map<string, React.RefObject<HTMLButtonElement | null>>>(new Map());

  function getSwatchRef(key: string): React.RefObject<HTMLButtonElement | null> {
    if (!swatchRefs.current.has(key)) {
      swatchRefs.current.set(key, { current: null });
    }
    return swatchRefs.current.get(key)!;
  }

  if (courseTypeSettings.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4">
        <p className="text-sm font-medium text-[--color-text-primary] mb-1">
          Event type filters
        </p>
        <p className="text-xs text-[--color-text-secondary]">
          Run sync to discover event types for your courses.
        </p>
      </div>
    );
  }

  // Group settings by courseName, preserving insertion order
  const byCourse = new Map<string, CourseTypeSetting[]>();
  for (const setting of courseTypeSettings) {
    const group = byCourse.get(setting.courseName) ?? [];
    group.push(setting);
    byCourse.set(setting.courseName, group);
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4 space-y-4">
      <p className="text-sm font-medium text-[--color-text-primary]">
        Event type filters
      </p>
      {[...byCourse.entries()].map(([courseName, settings]) => (
        <div key={courseName}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[--color-text-secondary] mb-2">
            {courseName}
          </p>
          <div className="flex flex-col gap-2 pl-1">
            {settings.map(({ eventType, enabled, colorId }) => {
              const key = `${courseName}:${eventType}`;
              const swatchRef = getSwatchRef(key);
              const colorHex = GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#7986CB';

              return (
                <div
                  key={key}
                  className="flex items-center gap-3 min-h-[44px]"
                >
                  {/* Color swatch button — opens ColorPicker */}
                  <button
                    ref={swatchRef}
                    type="button"
                    aria-label={`Change color for ${eventType} in ${courseName}`}
                    onClick={() => setOpenPickerKey(openPickerKey === key ? null : key)}
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-white/20 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-white/40"
                    style={{ backgroundColor: colorHex }}
                  />

                  {/* ColorPicker portal — rendered when this row's key is open */}
                  {openPickerKey === key && (
                    <ColorPicker
                      anchorRef={swatchRef}
                      currentColorId={colorId}
                      onSelect={(newColorId) => {
                        onColorChange(courseName, eventType, newColorId);
                        setOpenPickerKey(null);
                      }}
                      onClose={() => setOpenPickerKey(null)}
                    />
                  )}

                  {/* Checkbox + label */}
                  <label
                    className="flex items-center gap-3 cursor-pointer flex-1"
                  >
                    <input
                      type="checkbox"
                      id={`event-type-${courseName}-${eventType}`}
                      aria-label={`Sync ${eventType} for ${courseName}`}
                      className="w-4 h-4 rounded accent-indigo-500 flex-shrink-0 cursor-pointer"
                      checked={enabled}
                      onChange={(e) => onToggle(courseName, eventType, e.target.checked)}
                    />
                    <span className="text-sm text-[--color-text-primary]">{eventType}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-[--color-text-secondary]">
        Events are grouped into per-type sub-calendars: &ldquo;Canvas - CourseName — EventType&rdquo;.
        Unchecked types are not synced.
      </p>
    </div>
  );
}
