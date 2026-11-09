import { useId, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, className = '', ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium tracking-wide text-ink-400 uppercase">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className={`h-11 rounded-lg border border-ink-700 bg-ink-900 px-3 text-ink-50 placeholder:text-ink-600 transition-colors focus:border-ink-400 focus:outline-none ${className}`}
      />
    </div>
  )
}
