export default function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 shrink-0">{label}</span>
      <span className="font-mono text-[12px] text-zinc-300 truncate max-w-[65%] text-right ml-4">{value}</span>
    </div>
  );
}
