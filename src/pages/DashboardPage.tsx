import { useEffect, useState } from 'react'
import { Power, AlertTriangle, TrendingUp, ShieldCheck } from 'lucide-react'
import { Panel, Button, Select, TextInput, Toggle, Badge, Stat } from '@/components/ui'
import { useAppStore, getDeltaClient } from '@/lib/store'
import { botEngine } from '@/lib/botEngine'
import { saveBotConfig } from '@/lib/db'
import type { BotConfig, RiskSettings, TradingMode } from '@/types'

function newBotId() {
  return `bot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_RISK: RiskSettings = {
  positionSizeUsd: 100,
  leverage: 5,
  slPercent: 2,
  tpPercent: 4,
  dailyLossLimitUsd: 50,
  maxOpenPositions: 1,
}

export default function DashboardPage() {
  const settings = useAppStore((s) => s.settings)
  const indicators = useAppStore((s) => s.indicators)
  const refreshIndicators = useAppStore((s) => s.refreshIndicators)
  const bots = useAppStore((s) => s.bots)
  const refreshBots = useAppStore((s) => s.refreshBots)
  const positions = useAppStore((s) => s.positions)
  const balances = useAppStore((s) => s.balances)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus)
  const setPositions = useAppStore((s) => s.setPositions)
  const setBalances = useAppStore((s) => s.setBalances)

  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>('')
  const [symbol, setSymbol] = useState(settings.defaultSymbol)
  const [resolution, setResolution] = useState(settings.defaultResolution)
  const [mode, setMode] = useState<TradingMode>('paper')
  const [risk, setRisk] = useState<RiskSettings>(DEFAULT_RISK)
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false)
  const [, forceRerender] = useState(0)

  useEffect(() => {
    refreshIndicators()
    refreshBots()
  }, [refreshIndicators, refreshBots])

  useEffect(() => {
    const unsub = botEngine.subscribe(() => forceRerender((n) => n + 1))
    return unsub
  }, [])

  // Poll account data when connected
  useEffect(() => {
    const client = getDeltaClient()
    if (!client) {
      setConnectionStatus('unconfigured')
      return
    }

    let cancelled = false
    const poll = async () => {
      try {
        const [bal, pos] = await Promise.all([client.getBalances(), client.getPositions()])
        if (cancelled) return
        setBalances(bal)
        setPositions(pos)
        setConnectionStatus('connected')
      } catch (err) {
        if (!cancelled) setConnectionStatus('error', (err as Error).message)
      }
    }
    poll()
    const id = window.setInterval(poll, 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [settings.credentials, setBalances, setPositions, setConnectionStatus])

  const handleActivate = async () => {
    if (!selectedIndicatorId) return
    if (mode === 'live') {
      setLiveConfirmOpen(true)
      return
    }
    await startBot()
  }

  const startBot = async () => {
    const indicator = indicators.find((i) => i.id === selectedIndicatorId)
    if (!indicator) return

    const config: BotConfig = {
      id: newBotId(),
      indicatorId: indicator.id,
      symbol,
      resolution,
      mode,
      risk,
      isActive: true,
      createdAt: Date.now(),
    }
    await saveBotConfig(config)
    await refreshBots()
    botEngine.start(config, indicator)
    setLiveConfirmOpen(false)
  }

  const handleStop = (botId: string) => {
    botEngine.stop(botId)
  }

  const totalUnrealizedPnl = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0)
  const usdBalance = balances.find((b) => b.asset === 'USD' || b.asset === 'USDT')

  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-5 overflow-y-auto p-6 scrollbar-thin">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-4">
          <Panel>
            <Stat label="Available Balance" value={usdBalance ? `$${usdBalance.availableBalance.toFixed(2)}` : '—'} />
          </Panel>
          <Panel>
            <Stat
              label="Unrealized PnL"
              value={`${totalUnrealizedPnl >= 0 ? '+' : ''}$${totalUnrealizedPnl.toFixed(2)}`}
              tone={totalUnrealizedPnl >= 0 ? 'bull' : 'bear'}
            />
          </Panel>
          <Panel>
            <Stat label="Open Positions" value={String(positions.length)} />
          </Panel>
          <Panel>
            <Stat label="Active Bots" value={String(botEngine.getRunningIds().length)} tone="cyan" />
          </Panel>
        </div>

        {connectionStatus === 'error' && (
          <div className="flex items-center gap-2.5 rounded-xl bg-bear/10 px-4 py-3 text-[13px] text-bear ring-1 ring-bear/25">
            <AlertTriangle size={16} />
            Could not reach Delta Exchange API — check your API keys in Settings.
          </div>
        )}
        {connectionStatus === 'unconfigured' && (
          <div className="flex items-center gap-2.5 rounded-xl bg-warn/10 px-4 py-3 text-[13px] text-warn ring-1 ring-warn/25">
            <AlertTriangle size={16} />
            No API credentials yet — set them in Settings to see live balances and place orders.
          </div>
        )}

        <Panel title="Running Bots" subtitle={`${bots.length} configured`}>
          <div className="space-y-2.5">
            {bots.length === 0 && <p className="text-[12.5px] text-ink-faint">No bots configured yet. Activate one below.</p>}
            {bots.map((bot) => {
              const indicator = indicators.find((i) => i.id === bot.indicatorId)
              const isRunning = botEngine.isRunning(bot.id)
              return (
                <div key={bot.id} className="flex items-center justify-between rounded-lg bg-base-raised px-4 py-3 ring-1 ring-base-border">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-bull animate-pulse-dot' : 'bg-ink-faint'}`} />
                    <div>
                      <div className="text-[13px] font-medium text-ink">
                        {indicator?.name ?? 'Unknown indicator'} — {bot.symbol}
                      </div>
                      <div className="text-[11px] text-ink-faint">
                        {bot.resolution} · ${bot.risk.positionSizeUsd} size · {bot.risk.leverage}x
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={bot.mode === 'live' ? 'bear' : 'cyan'}>{bot.mode === 'live' ? 'LIVE' : 'PAPER'}</Badge>
                    {isRunning ? (
                      <Button size="sm" variant="danger" onClick={() => handleStop(bot.id)}>
                        <Power size={13} /> Stop
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => indicator && botEngine.start(bot, indicator)}
                        disabled={!indicator}
                      >
                        <Power size={13} /> Start
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="Activate a Bot" subtitle="Pick an indicator and risk settings">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Indicator</label>
              <Select value={selectedIndicatorId} onChange={(e) => setSelectedIndicatorId(e.target.value)}>
                <option value="">Select a saved indicator…</option>
                {indicators.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              {indicators.length === 0 && (
                <p className="mt-1.5 text-[11.5px] text-ink-faint">No saved indicators — go save one in the Indicator Editor first.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Symbol</label>
                <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                  <option value="BTCUSD">BTCUSD</option>
                  <option value="ETHUSD">ETHUSD</option>
                  <option value="SOLUSD">SOLUSD</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Resolution</label>
                <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                </Select>
              </div>
            </div>

            <div className="rounded-lg bg-base-raised p-3.5 ring-1 ring-base-border">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-ink">Trading Mode</span>
                <Toggle checked={mode === 'live'} onChange={(v) => setMode(v ? 'live' : 'paper')} label={mode === 'live' ? 'Live' : 'Paper'} />
              </div>
              {mode === 'live' && (
                <p className="text-[11.5px] text-bear">⚠ Live mode places real orders with real funds.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <RiskField label="Position Size (USD)" value={risk.positionSizeUsd} onChange={(v) => setRisk((r) => ({ ...r, positionSizeUsd: v }))} />
              <RiskField label="Leverage (x)" value={risk.leverage} onChange={(v) => setRisk((r) => ({ ...r, leverage: v }))} />
              <RiskField label="Stop Loss (%)" value={risk.slPercent} onChange={(v) => setRisk((r) => ({ ...r, slPercent: v }))} step={0.1} />
              <RiskField label="Take Profit (%)" value={risk.tpPercent} onChange={(v) => setRisk((r) => ({ ...r, tpPercent: v }))} step={0.1} />
              <RiskField label="Daily Loss Limit (USD)" value={risk.dailyLossLimitUsd} onChange={(v) => setRisk((r) => ({ ...r, dailyLossLimitUsd: v }))} />
              <RiskField label="Max Open Positions" value={risk.maxOpenPositions} onChange={(v) => setRisk((r) => ({ ...r, maxOpenPositions: v }))} />
            </div>

            <Button variant="primary" className="w-full" disabled={!selectedIndicatorId} onClick={handleActivate}>
              <TrendingUp size={14} /> Activate Bot
            </Button>
          </div>
        </Panel>

        <Panel title="Risk Summary">
          <div className="flex items-start gap-2.5 text-[12px] text-ink-dim">
            <ShieldCheck size={15} className="mt-0.5 text-cyan" />
            <p>
              Max loss per trade ≈ ${((risk.positionSizeUsd * risk.leverage * risk.slPercent) / 100).toFixed(2)}. Bot auto-pauses for the day once cumulative paper/live PnL hits −${risk.dailyLossLimitUsd}.
            </p>
          </div>
        </Panel>
      </div>

      {liveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md animate-slide-up rounded-xl border border-bear/30 bg-base-panel p-6 shadow-glow">
            <div className="mb-3 flex items-center gap-2.5 text-bear">
              <AlertTriangle size={20} />
              <h3 className="font-display text-[15px] font-semibold">Confirm Live Trading</h3>
            </div>
            <p className="text-[13px] text-ink-dim">
              This bot will place <strong className="text-ink">real market orders with real funds</strong> on {symbol}, sized at ${risk.positionSizeUsd} × {risk.leverage}x leverage,
              every time the indicator signals. Make sure you've paper-traded this exact indicator first.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setLiveConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={startBot}>
                I understand — go live
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RiskField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11.5px] font-medium text-ink-dim">{label}</label>
      <TextInput
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  )
}
