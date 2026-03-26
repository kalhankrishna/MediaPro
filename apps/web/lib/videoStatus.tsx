// Shared video status config — used by VideoList (dashboard) and VideoDetail (detail page).

export const STATUS: Record<number, { label: string; dot: string; text: string; pulse: boolean }> = {
  0: { label: 'unknown',      dot: 'bg-zinc-600',    text: 'text-zinc-500',    pulse: false },
  1: { label: 'uploaded',     dot: 'bg-zinc-500',    text: 'text-zinc-400',    pulse: false },
  2: { label: 'processing',   dot: 'bg-sky-500',     text: 'text-sky-400',     pulse: true  },
  3: { label: 'completed',    dot: 'bg-emerald-500', text: 'text-emerald-400', pulse: false },
  4: { label: 'failed',       dot: 'bg-red-500',     text: 'text-red-400',     pulse: false },
  5: { label: 'transcribing', dot: 'bg-sky-500',     text: 'text-sky-400',     pulse: true  },
  6: { label: 'embedding',    dot: 'bg-sky-500',     text: 'text-sky-400',     pulse: true  },
};

export const COMPLETED = 3;
export const FAILED = 4;
export const TERMINAL = new Set([COMPLETED, FAILED]);

export function StatusBadge({ status }: { status: number }) {
  const cfg = STATUS[status] ?? STATUS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${cfg.text}`}>
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`}
      />
      {cfg.label}
    </span>
  );
}
