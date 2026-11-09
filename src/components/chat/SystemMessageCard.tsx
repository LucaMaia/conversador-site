import type { SystemMessageTemplate } from '../../domain/systemMessages.ts'

/** Mensagem oficial do sistema/LM: centralizada, com selo de identificação. */
export function SystemMessageCard({ template }: { template: SystemMessageTemplate }) {
  return (
    <li className="my-2 flex justify-center animate-[fade-in_150ms_ease-out]">
      <article
        aria-label="Mensagem oficial do sistema"
        className="w-full max-w-md rounded-2xl border border-accent-500/30 bg-ink-900 px-4 py-3.5 text-ink-200"
      >
        <header className="mb-2.5 flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="size-3.5 text-accent-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" />
            <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[11px] font-semibold tracking-wide text-accent-500 uppercase">Mensagem oficial · LM</span>
        </header>
        <h2 className="text-[15px] font-semibold text-ink-50">{template.title}</h2>
        {template.paragraphs.map((p) => (
          <p key={p} className="mt-2 text-sm leading-relaxed">
            {p}
          </p>
        ))}
        <h3 className="mt-3 text-sm font-semibold text-ink-50">{template.sectionTitle}</h3>
        <ul className="mt-1.5 flex flex-col gap-1 pl-4 text-sm leading-relaxed">
          {template.bullets.map((b) => (
            <li key={b} className="list-disc marker:text-ink-400">
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed">{template.footer}</p>
      </article>
    </li>
  )
}
