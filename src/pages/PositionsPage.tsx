import { useEffect } from 'react'
import { Panel, Badge } from '@/components/ui'
import { useAppStore, getDeltaClient } from '@/lib/store'

export default function PositionsPage() {
  const positions = useAppStore((s) => s.positions)
  const setPositions = useAppStore((s) => s.setPositions)

  useEffect(() => {
    const client = getDeltaClient()
    if (!client) return
    let cancelled = false
    const poll = async () => {
      try {
        const pos = await client.getPositions()
        if (!cancelled) setPositions(pos)
      } catch {
        // swallow — Dashboard already surfaces connection errors
      }
    }
    poll()
    const id = window.setInterval(poll, 10000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [setPositions])

  return (
    <div className="h-full overflow-y-auto p-6 scrollbar-thin">
      <Panel title="Open Positions" subtitle={`${positions.length} position(s)`}>
        {positions.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-faint">No open positions.</p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-base-border text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2.5 pr-4 font-medium">Symbol</th>
                <th className="py-2.5 pr-4 font-medium">Side</th>
                <th className="py-2.5 pr-4 font-medium">Size</th>
                <th className="py-2.5 pr-4 font-medium">Entry Price</th>
                <th className="py-2.5 pr-4 font-medium">Mark Price</th>
                <th className="py-2.5 pr-4 font-medium">Liquidation</th>
                <th className="py-2.5 pr-4 font-medium">Leverage</th>
                <th className="py-2.5 font-medium text-right">Unrealized PnL</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-b border-base-border/60">
                  <td className="py-3 pr-4 font-medium text-ink">{p.symbol}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={p.side === 'long' ? 'bull' : 'bear'}>{p.side.toUpperCase()}</Badge>
                  </td>
                  <td className="text-mono-tabular py-3 pr-4 text-ink-dim">{p.size}</td>
                  <td className="text-mono-tabular py-3 pr-4 text-ink-dim">${p.entryPrice.toFixed(2)}</td>
                  <td className="text-mono-tabular py-3 pr-4 text-ink-dim">${p.markPrice.toFixed(2)}</td>
                  <td className="text-mono-tabular py-3 pr-4 text-ink-dim">{p.liquidationPrice ? `$${p.liquidationPrice.toFixed(2)}` : '—'}</td>
                  <td className="text-mono-tabular py-3 pr-4 text-ink-dim">{p.leverage}x</td>
                  <td className={`text-mono-tabular py-3 text-right font-semibold ${p.unrealizedPnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                    {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
