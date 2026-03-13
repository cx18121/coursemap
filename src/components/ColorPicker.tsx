'use client';

import { useEffect, useRef } from 'react';

export const GOOGLE_CALENDAR_COLORS: Record<string, { name: string; hex: string }> = {
  '1':  { name: 'Lavender',  hex: '#7986CB' },
  '2':  { name: 'Sage',      hex: '#33B679' },
  '3':  { name: 'Grape',     hex: '#8E24AA' },
  '4':  { name: 'Flamingo',  hex: '#E67C73' },
  '5':  { name: 'Banana',    hex: '#F6BF26' },
  '6':  { name: 'Tangerine', hex: '#F4511E' },
  '7':  { name: 'Peacock',   hex: '#039BE5' },
  '8':  { name: 'Graphite',  hex: '#616161' },
  '9':  { name: 'Blueberry', hex: '#3F51B5' },
  '10': { name: 'Basil',     hex: '#0B8043' },
  '11': { name: 'Tomato',    hex: '#D50000' },
};

interface ColorPickerProps {
  currentColorId: string;
  onSelect: (colorId: string) => void;
  onClose: () => void;
}

export default function ColorPicker({ currentColorId, onSelect, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-[--color-surface] border border-[--color-border] rounded-xl shadow-xl p-2 w-44"
    >
      <div className="grid grid-cols-2 gap-1">
        {Object.entries(GOOGLE_CALENDAR_COLORS).map(([id, { name, hex }]) => (
          <button
            key={id}
            onClick={() => {
              onSelect(id);
              onClose();
            }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[--color-text-primary] hover:bg-white/10 transition-colors ${
              currentColorId === id ? 'bg-white/15 font-medium' : ''
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: hex }}
            />
            <span className="truncate">{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
