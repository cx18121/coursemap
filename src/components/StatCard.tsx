'use client';

import { memo, useEffect, useRef, useState } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  active: boolean;
  onClick: () => void;
}

const StatCard = memo(function StatCard({ label, value, active, onClick }: StatCardProps) {
  const prevRef = useRef(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value && value !== '--') {
      setPopping(true);
      const t = setTimeout(() => setPopping(false), 300);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-2.5 md:p-4 cursor-pointer transition-all w-full text-left active:scale-[0.97]${
        active
          ? ' border-amber-300 bg-amber-50 hover:bg-amber-50'
          : ' bg-white border-[--color-border] hover:bg-[--color-surface-raised]'
      }`}
    >
      <div className="flex flex-col gap-0.5 md:gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-[--color-text-secondary] truncate">{label}</span>
        <span
          className={`text-xl md:text-2xl font-semibold tabular-nums text-[--color-text-primary] inline-block origin-left ${popping ? 'animate-value-pop' : ''}`}
        >
          {value}
        </span>
      </div>
    </button>
  );
});

export default StatCard;
