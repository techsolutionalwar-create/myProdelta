import type { IndicatorParamDef } from '@/types'
import { Toggle } from './ui'

interface ParamControlsProps {
  paramDefs: Record<string, IndicatorParamDef>
  values: Record<string, number | boolean | string>
  onChange: (key: string, value: number | boolean | string) => void
}

export default function ParamControls({ paramDefs, values, onChange }: ParamControlsProps) {
  const entries = Object.entries(paramDefs)

  if (entries.length === 0) {
    return <p className="text-[12.5px] text-ink-faint">No editable parameters detected in this indicator's code.</p>
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, def]) => {
        const value = values[key] ?? def.default

        if (def.type === 'boolean') {
          return (
            <Toggle
              key={key}
              checked={Boolean(value)}
              onChange={(v) => onChange(key, v)}
              label={def.label ?? key}
            />
          )
        }

        if (def.type === 'select' && def.options) {
          return (
            <div key={key}>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">{def.label ?? key}</label>
              <select
                value={String(value)}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full rounded-lg border border-base-border bg-base-raised px-3 py-2 text-[13px] text-ink focus:border-cyan/50 focus:outline-none"
              >
                {def.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )
        }

        const min = def.min ?? 0
        const max = def.max ?? 100
        const step = def.step ?? 1

        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-medium text-ink-dim">{def.label ?? key}</label>
              <span className="text-mono-tabular rounded bg-base-raised px-1.5 py-0.5 text-[11.5px] text-cyan">
                {Number(value)}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={Number(value)}
              onChange={(e) => onChange(key, parseFloat(e.target.value))}
              className="w-full accent-cyan"
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-faint">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
