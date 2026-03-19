'use client';

interface StatCardProps {
  label: string;
  value: number | string;
  active: boolean;
  onClick: () => void;
}

export default function StatCard({ label, value, active, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border] p-4 cursor-pointer hover:bg-white/[0.15] transition-colors w-full text-left${
        active ? ' ring-1 ring-indigo-400/60' : ''
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[--color-text-secondary]">{label}</span>
        <span className="text-2xl font-semibold text-[--color-text-primary]">{value}</span>
      </div>
    </button>
  );
}
