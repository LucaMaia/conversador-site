import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Texto para leitores de tela e dica ao passar o mouse. */
  label: string
  children: ReactNode
  tone?: 'default' | 'danger'
}

/** Botão só com ícone. Área de toque de 40×40 px, ícone de 18 px. */
export function IconButton({ label, children, tone = 'default', className = '', ...rest }: IconButtonProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-ink-600 hover:bg-danger-500/10 hover:text-danger-500'
      : 'text-ink-400 hover:bg-ink-800 hover:text-ink-50'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent-500 active:scale-95 disabled:opacity-40 [&>svg]:size-[18px] ${toneClass} ${className}`}
    >
      {children}
    </button>
  )
}
