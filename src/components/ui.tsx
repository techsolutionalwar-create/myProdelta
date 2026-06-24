import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

// ─── Panel ──────────────────────────────────────────────────────────────

export function Panel({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className={clsx('rounded-xl border border-base-border bg-base-panel', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-base-border px-5 py-4">
          <div>
            {title && <h3 className="font-display text-[14px] font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-faint">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Button ─────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
        size === 'md' ? 'px-4 py-2.5 text-[13px]' : 'px-3 py-1.5 text-[12px]',
        variant === 'primary' && 'bg-cyan text-base shadow-glow-sm hover:bg-cyan/90 active:scale-[0.98]',
        variant === 'secondary' &&
          'bg-base-raised text-ink ring-1 ring-base-border hover:bg-[#1c2030] active:scale-[0.98]',
        variant === 'danger' && 'bg-bear/15 text-bear ring-1 ring-bear/30 hover:bg-bear/25',
        variant === 'ghost' && 'text-ink-dim hover:bg-base-raised hover:text-ink',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

// ─── Badge ──────────────────────────────────────────────────────────────

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'bull' | 'bear' | 'cyan' | 'warn' }) {
  const toneClasses = {
    neutral: 'bg-base-raised text-ink-dim ring-base-border',
    bull: 'bg-bull/10 text-bull ring-bull/30',
    bear: 'bg-bear/10 text-bear ring-bear/30',
    cyan: 'bg-cyan/10 text-cyan ring-cyan/30',
    warn: 'bg-warn/10 text-warn ring-warn/30',
  }
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1', toneClasses[tone])}>
      {children}
    </span>
  )
}

// ─── Input / Select ─────────────────────────────────────────────────────

export function TextInput({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border border-base-border bg-base-raised px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-faint',
        'focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/30',
        className
      )}
      {...rest}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full rounded-lg border border-base-border bg-base-raised px-3 py-2.5 text-[13px] text-ink',
        'focus:border-cyan/50 focus:outline-none focus:ring-1 focus:ring-cyan/30',
        className
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-cyan' : 'bg-base-raised ring-1 ring-base-border'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-base transition-transform',
            checked ? 'translate-x-[18px] bg-[#04161c]' : 'translate-x-0.5 bg-ink-faint'
          )}
        />
      </button>
      {label && <span className="text-[13px] text-ink-dim">{label}</span>}
    </label>
  )
}

// ─── Stat ───────────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  tone = 'neutral',
  mono = true,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'bull' | 'bear' | 'cyan'
  mono?: boolean
}) {
  const toneClass = {
    neutral: 'text-ink',
    bull: 'text-bull',
    bear: 'text-bear',
    cyan: 'text-cyan',
  }[tone]
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={clsx('mt-1 text-[20px] font-semibold', mono && 'text-mono-tabular', toneClass)}>{value}</div>
    </div>
  )
}
