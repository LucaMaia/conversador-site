import type { ReactNode } from 'react'

export function CenteredCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm animate-[fade-in_200ms_ease-out]">
        <h1 className="text-lg font-semibold text-ink-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </section>
    </main>
  )
}
