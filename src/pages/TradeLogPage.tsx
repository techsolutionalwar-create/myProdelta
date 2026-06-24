import { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Panel, Badge, Button } from '@/components/ui'
import { useAppStore } from '@/lib/store'
import { clearTradeLog } from '@/lib/db'

export default function TradeLogPage() {
  const tradeLog = useAppStore((s) => s.tradeLog)
  const refreshTradeLog = useAppStore((s) => s.refreshTradeLog)

  useEffect(() => {
    refreshTradeLog()
    const id = window.setInterval(refreshTradeLog, 5000)
    return () => window.clearInterval(id)
  }, [refreshTradeLog])

  const handleClear = async () => {
    if (!confirm('Clear the entire trade log? This cannot be undone.')) return
    await clearTradeLog()
    await refreshTradeLog()
  }

  return (
    <div className="h-full overflow-y-auto p-6 scrollbar-thin">
      <Panel
        title="Trade Log"
        subtitle={`${tradeLog.length} entries`}
        actions={
          <Button size="sm" variant="ghost" onClick={handleClear}>
            <Trash2 size={13} /> Clear
          </Button>
        }
      >
        {tradeLog.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-faint">No trades logged yet. Activate a bot to start.</p>
        ) : (
          <div className="space-y-2">
            {tradeLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-base-raised px-4 py-3 ring-1 ring-base-border">
                <div className="flex items-center gap-3">
                  <Badge tone={entry.side === 'buy' ? 'bull' : 'bear'}>{entry.side.toUpperCase()}</Badge>
                  <div>
                    <div className="text-[13px] font-medium text-ink">
                      {entry.symbol} @ ${entry.price.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      {entry.indicatorName} · {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="max-w-xs truncate text-[11.5px] text-ink-dim" title={entry.reason}>
                    {entry.reason}
                  </span>
                  {entry.pnl !== undefined && (
                    <span className={`text-mono-tabular text-[13px] font-semibold ${entry.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>
                      {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                    </span>
                  )}
                  <Badge tone={entry.status === 'REJECTED' ? 'bear' : entry.mode === 'live' ? 'bear' : 'cyan'}>
                    {entry.status === 'REJECTED' ? 'REJECTED' : entry.mode === 'live' ? 'LIVE' : 'PAPER'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
