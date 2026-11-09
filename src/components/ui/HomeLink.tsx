import { Link } from 'react-router-dom'

/** Volta à tela inicial (campo do código). */
export function HomeLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200 ${className}`}
    >
      <span aria-hidden>←</span> Início
    </Link>
  )
}
