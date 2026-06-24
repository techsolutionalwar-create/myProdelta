import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export default function TopBar() {
  const balances = useAppStore((s) => s.balances)
  const usdBalance = balances.find((b) => b.asset === 'USD' || b.asset === 'USDT')
  const [mode] = useState<'paper' | 'live'>('paper')

  return (
    <header className="flex h-16 items-center justify-between border-b border-base-border bg-base-panel/60 px-6 backdrop-blur-sm">
      <div>
        <h1 className="font-display text-[15px] font-semibold text-ink">
          {mode === 'paper' ? 'Paper Trading' : 'Live Trading'}
        </h1>
        <p className="text-[11.5px] text-ink-faint">api.india.delta.exchange</p>
      </div>

      <div className="flex items-center gap-4">
        {mode === 'live' && (
          <div className="flex items-center gap-1.5 rounded-full bg-bear/10 px-3 py-1.5 text-[11.5px] font-medium text-bear ring-1 ring-bear/30">
            <ShieldAlert size={13} />
            Live — real orders enabled
          </div>
        )}
        <div className="rounded-lg bg-base-raised px-4 py-2 text-right">
          <div className="text-[10.5px] uppercase tracking-wide text-ink-faint">Available Balance</div>
          <div className="text-mono-tabular text-[14px] font-semibold text-ink">
            {usdBalance ? `$${usdBalance.availableBalance.toFixed(2)}` : '—'}
          </div>
        </div>
      </div>
    </header>
  )
}
