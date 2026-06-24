import { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  Play,
  Save,
  FolderOpen,
  Zap,
  FileCode2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Download,
  Trash2,
} from 'lucide-react'
import { Panel, Button, TextInput, Select, Badge, Stat } from '@/components/ui'
import ParamControls from '@/components/ParamControls'
import SignalChart from '@/components/SignalChart'
import { DEFAULT_INDICATOR_CODE, DEFAULT_INDICATOR_NAME } from '@/indicators/defaultTemplate'
import {
  compileIndicator,
  defaultParamValues,
  IndicatorCompileError,
  lintIndicatorCode,
  type CompiledIndicator,
} from '@/lib/indicatorRunner'
import { runBacktest } from '@/lib/backtest'
import { convertPineToJs } from '@/lib/pineConverter'
import { getDeltaClient, useAppStore } from '@/lib/store'
import { deleteIndicator, exportIndicatorAsJson, parseIndicatorJson, saveIndicator } from '@/lib/db'
import type { BacktestResult, Candle, SavedIndicator } from '@/types'

function newIndicatorId() {
  return `ind_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function IndicatorEditorPage() {
  const settings = useAppStore((s) => s.settings)
  const indicators = useAppStore((s) => s.indicators)
  const refreshIndicators = useAppStore((s) => s.refreshIndicators)

  const [code, setCode] = useState(DEFAULT_INDICATOR_CODE)
  const [name, setName] = useState(DEFAULT_INDICATOR_NAME)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, number | boolean | string>>({})
  const [compiled, setCompiled] = useState<CompiledIndicator | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [lintWarnings, setLintWarnings] = useState<string[]>([])

  const [candles, setCandles] = useState<Candle[]>([])
  const [backtest, setBacktest] = useState<BacktestResult | null>(null)
  const [isBacktesting, setIsBacktesting] = useState(false)
  const [backtestError, setBacktestError] = useState<string | null>(null)

  const [symbol, setSymbol] = useState(settings.defaultSymbol)
  const [resolution, setResolution] = useState(settings.defaultResolution)

  const [pineModalOpen, setPineModalOpen] = useState(false)
  const [pineInput, setPineInput] = useState('')
  const [pineWarnings, setPineWarnings] = useState<string[]>([])

  useEffect(() => {
    refreshIndicators()
  }, [refreshIndicators])

  useEffect(() => {
    setLintWarnings(lintIndicatorCode(code))
    try {
      const c = compileIndicator(code)
      setCompiled(c)
      setCompileError(null)
      setParamValues((prev) => {
        const defaults = defaultParamValues(c.params)
        const merged = { ...defaults }
        for (const k of Object.keys(defaults)) {
          if (prev[k] !== undefined) merged[k] = prev[k]
        }
        return merged
      })
    } catch (err) {
      setCompiled(null)
      if (err instanceof IndicatorCompileError) {
        setCompileError(err.message)
      } else {
        setCompileError((err as Error).message)
      }
    }
  }, [code])

  const handleLoadIndicator = (ind: SavedIndicator) => {
    setCode(ind.code)
    setName(ind.name)
    setCurrentId(ind.id)
    setParamValues(ind.params)
    setBacktest(null)
  }

  const handleSave = async () => {
    if (!compiled) return
    const id = currentId ?? newIndicatorId()
    const now = Date.now()
    const toSave: SavedIndicator = {
      id,
      name: name || 'Untitled Indicator',
      code,
      params: paramValues,
      paramDefs: compiled.params,
      createdAt: now,
      updatedAt: now,
      source: 'manual',
    }
    await saveIndicator(toSave)
    setCurrentId(id)
    await refreshIndicators()
  }

  const handleDelete = async (id: string) => {
    await deleteIndicator(id)
    if (currentId === id) setCurrentId(null)
    await refreshIndicators()
  }

  const handleExport = () => {
    if (!compiled) return
    const ind: SavedIndicator = {
      id: currentId ?? newIndicatorId(),
      name,
      code,
      params: paramValues,
      paramDefs: compiled.params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'manual',
    }
    const blob = new Blob([exportIndicatorAsJson(ind)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const ind = parseIndicatorJson(String(reader.result))
        setCode(ind.code)
        setName(ind.name)
        setCurrentId(null)
        setParamValues(ind.params)
      } catch (err) {
        alert(`Could not import: ${(err as Error).message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleTest = async () => {
    setBacktestError(null)
    setIsBacktesting(true)
    setBacktest(null)
    try {
      const client = getDeltaClient()
      let candleData: Candle[]
      if (client) {
        candleData = await client.getCandles(symbol, resolution, 500)
      } else {
        candleData = generateMockCandles(500)
      }
      setCandles(candleData)

      if (!compiled) throw new Error('Indicator failed to compile — fix errors first')
      const result = runBacktest(candleData, compiled, paramValues, {
        slPercent: 2,
        tpPercent: 4,
      })
      setBacktest(result)
    } catch (err) {
      setBacktestError((err as Error).message)
    } finally {
      setIsBacktesting(false)
    }
  }

  const handlePineConvert = () => {
    const result = convertPineToJs(pineInput)
    setCode(result.code)
    setPineWarnings(result.warnings)
    setPineModalOpen(false)
    setCurrentId(null)
  }

  const overlaySeries = useMemo(() => {
    if (!backtest) return {}
    const filtered: Record<string, { time: number; value: number }[]> = {}
    for (const [key, points] of Object.entries(backtest.series)) {
      if (key.toLowerCase().includes('ema') || key.toLowerCase().includes('sma') || key.toLowerCase().includes('vwap')) {
        filtered[key] = points
      }
    }
    return filtered
  }, [backtest])

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-5 p-6">
      <div className="flex flex-col gap-5 overflow-y-auto scrollbar-thin pr-1">
        <Panel
          title="Custom Indicator Engine"
          subtitle="Write JS using the built-in helper functions, or paste Pine Script to auto-convert"
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setPineModalOpen(true)}>
                <FileCode2 size={14} /> Paste Pine Script
              </Button>
            </div>
          }
        >
          <div className="mb-3 flex items-center gap-3">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Indicator name"
              className="max-w-xs"
            />
            {compileError ? (
              <Badge tone="bear">
                <AlertTriangle size={12} className="mr-1 inline" /> Compile error
              </Badge>
            ) : (
              <Badge tone="bull">
                <CheckCircle2 size={12} className="mr-1 inline" /> Compiles OK
              </Badge>
            )}
          </div>

          <div className="overflow-hidden rounded-lg ring-1 ring-base-border">
            <Editor
              height="380px"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? '')}
              options={{
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbers: 'on',
                tabSize: 2,
              }}
            />
          </div>

          {compileError && (
            <div className="mt-3 rounded-lg bg-bear/10 px-3 py-2.5 text-[12.5px] text-bear ring-1 ring-bear/20">
              {compileError}
            </div>
          )}

          {lintWarnings.length > 0 && !compileError && (
            <div className="mt-3 space-y-1">
              {lintWarnings.map((w, i) => (
                <div key={i} className="rounded-lg bg-warn/10 px-3 py-2 text-[12px] text-warn ring-1 ring-warn/20">
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <Select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-32">
              <option value="BTCUSD">BTCUSD</option>
              <option value="ETHUSD">ETHUSD</option>
              <option value="SOLUSD">SOLUSD</option>
            </Select>
            <Select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-24">
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
            </Select>
            <Button variant="primary" onClick={handleTest} disabled={!compiled || isBacktesting}>
              <Play size={14} /> {isBacktesting ? 'Running…' : 'Test (Backtest 500 candles)'}
            </Button>
            <Button variant="secondary" onClick={handleSave} disabled={!compiled}>
              <Save size={14} /> Save
            </Button>
            <Button variant="secondary" onClick={handleExport} disabled={!compiled}>
              <Download size={14} /> Export JSON
            </Button>
            <label className="cursor-pointer">
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
              <span className="inline-flex items-center gap-2 rounded-lg bg-base-raised px-4 py-2.5 text-[13px] font-medium text-ink ring-1 ring-base-border hover:bg-[#1c2030]">
                <Upload size={14} /> Import JSON
              </span>
            </label>
          </div>

          {backtestError && (
            <div className="mt-3 rounded-lg bg-bear/10 px-3 py-2.5 text-[12.5px] text-bear ring-1 ring-bear/20">
              Backtest failed: {backtestError}
            </div>
          )}

          {!getDeltaClient() && (
            <div className="mt-3 rounded-lg bg-cyan/5 px-3 py-2.5 text-[12px] text-ink-dim ring-1 ring-cyan/15">
              No API credentials configured — Test will run on simulated mock candles. Add your Delta Exchange keys in Settings to backtest on real data.
            </div>
          )}
        </Panel>

        <Panel title="Backtest Result" subtitle={backtest ? `${candles.length} candles · ${symbol} · ${resolution}` : 'Run Test to see signals on chart'}>
          <SignalChart candles={candles} signals={backtest?.points} overlaySeries={overlaySeries} height={380} />

          {backtest && (
            <div className="mt-5 grid grid-cols-6 gap-4 border-t border-base-border pt-5">
              <Stat label="Total Trades" value={String(backtest.stats.totalTrades)} />
              <Stat
                label="Win Rate"
                value={`${backtest.stats.winRate.toFixed(1)}%`}
                tone={backtest.stats.winRate >= 50 ? 'bull' : 'bear'}
              />
              <Stat
                label="Total PnL"
                value={`${backtest.stats.totalPnlPct >= 0 ? '+' : ''}${backtest.stats.totalPnlPct.toFixed(2)}%`}
                tone={backtest.stats.totalPnlPct >= 0 ? 'bull' : 'bear'}
              />
              <Stat label="Avg PnL / Trade" value={`${backtest.stats.avgPnlPct.toFixed(2)}%`} />
              <Stat label="Best Trade" value={`+${backtest.stats.bestTradePct.toFixed(2)}%`} tone="bull" />
              <Stat label="Worst Trade" value={`${backtest.stats.worstTradePct.toFixed(2)}%`} tone="bear" />
            </div>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto scrollbar-thin">
        <Panel title="Parameters" subtitle="Auto-generated from your code's params object">
          {compiled && (
            <ParamControls
              paramDefs={compiled.params}
              values={paramValues}
              onChange={(k, v) => setParamValues((p) => ({ ...p, [k]: v }))}
            />
          )}
        </Panel>

        <Panel title="Activate Live" subtitle="Plug this indicator into the bot engine">
          <p className="mb-3 text-[12.5px] text-ink-dim">
            Configure position size, stop-loss/take-profit %, and daily loss limit on the Dashboard before activating. Always paper trade first.
          </p>
          <Button variant="primary" className="w-full" disabled={!compiled}>
            <Zap size={14} /> Go to Dashboard to Activate
          </Button>
        </Panel>

        <Panel title="Saved Indicators" subtitle={`${indicators.length} saved`}>
          <div className="space-y-2">
            {indicators.length === 0 && <p className="text-[12.5px] text-ink-faint">No saved indicators yet.</p>}
            {indicators.map((ind) => (
              <div
                key={ind.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 ring-1 ${
                  currentId === ind.id ? 'bg-cyan/5 ring-cyan/30' : 'bg-base-raised ring-base-border'
                }`}
              >
                <button onClick={() => handleLoadIndicator(ind)} className="flex-1 text-left">
                  <div className="text-[13px] font-medium text-ink">{ind.name}</div>
                  <div className="text-[11px] text-ink-faint">
                    {ind.source === 'pine-converted' ? 'Pine-converted' : 'Manual'} · {new Date(ind.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <div className="flex gap-1">
                  <button onClick={() => handleLoadIndicator(ind)} className="rounded p-1.5 text-ink-faint hover:bg-base-border hover:text-cyan">
                    <FolderOpen size={14} />
                  </button>
                  <button onClick={() => handleDelete(ind.id)} className="rounded p-1.5 text-ink-faint hover:bg-bear/10 hover:text-bear">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {pineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPineModalOpen(false)}>
          <div
            className="w-full max-w-2xl animate-slide-up rounded-xl border border-base-border bg-base-panel p-6 shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[15px] font-semibold text-ink">Paste Pine Script</h3>
            <p className="mt-1 text-[12.5px] text-ink-dim">
              Best-effort conversion only. Pine and this engine have different execution models — review the generated TODOs before trusting any signal.
            </p>
            <textarea
              value={pineInput}
              onChange={(e) => setPineInput(e.target.value)}
              placeholder={'//@version=5\nindicator("My Script")\nfastLen = input.int(9, "Fast Length")\n...'}
              className="mt-4 h-56 w-full rounded-lg border border-base-border bg-base-raised p-3 font-mono text-[12.5px] text-ink placeholder:text-ink-faint focus:border-cyan/50 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <Button variant="ghost" onClick={() => setPineModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handlePineConvert} disabled={!pineInput.trim()}>
                Convert to JS
              </Button>
            </div>
          </div>
        </div>
      )}

      {pineWarnings.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 max-w-md animate-slide-up rounded-xl border border-warn/30 bg-base-panel p-4 shadow-glow">
          <div className="mb-2 flex items-center gap-2 text-warn">
            <AlertTriangle size={14} />
            <span className="text-[13px] font-semibold">Conversion warnings</span>
          </div>
          <ul className="space-y-1 text-[11.5px] text-ink-dim">
            {pineWarnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setPineWarnings([])}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}

function generateMockCandles(count: number): Candle[] {
  const out: Candle[] = []
  let price = 65000
  const now = Math.floor(Date.now() / 1000)
  for (let i = 0; i < count; i++) {
    const drift = (Math.random() - 0.5) * price * 0.004
    const open = price
    const close = price + drift
    const high = Math.max(open, close) + Math.random() * price * 0.001
    const low = Math.min(open, close) - Math.random() * price * 0.001
    out.push({
      time: now - (count - i) * 300,
      open,
      high,
      low,
      close,
      volume: 10 + Math.random() * 50,
    })
    price = close
  }
  return out
}
