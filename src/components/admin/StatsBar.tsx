import type { ReactNode } from 'react'

export function StatsBar({ active, expired }: { active: number; expired: number }) {
  return (
    <dl className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <Stat label="Ativas" value={active} />
      <Stat
        label={
          <>
            Expiradas<span className="hidden sm:inline"> (em limpeza)</span>
          </>
        }
        value={expired}
      />
    </dl>
  )
}

function Stat({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 px-3.5 py-2.5 sm:px-4 sm:py-3">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink-50 sm:mt-1 sm:text-2xl">{value}</dd>
    </div>
  )
}
