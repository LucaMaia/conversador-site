export function StatsBar({ active, expired }: { active: number; expired: number }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <Stat label="Ativas" value={active} />
      <Stat label="Expiradas (em limpeza)" value={expired} />
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-3">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-50">{value}</dd>
    </div>
  )
}
