import type { BacktestResult, BacktestStats, BacktestTrade, Candle } from '@/types'
import type { CompiledIndicator } from './indicatorRunner'

export function runBacktest(
  candles: Candle[],
  indicator: CompiledIndicator,
  paramValues: Record<string, unknown>,
  opts: { slPercent?: number; tpPercent?: number; warmup?: number } = {}
): BacktestResult {
  const warmup = opts.warmup ?? Math.min(60, Math.floor(candles.length / 4))
  const points: BacktestResult['points'] = []
  const trades: BacktestTrade[] = []
  const seriesAccumulator: Record<string, { time: number; value: number }[]> = {}

  let openTrade: BacktestTrade | null = null

  for (let i = warmup; i < candles.length; i++) {
    const window = candles.slice(0, i + 1) // run() sees all candles up to i, mirrors live polling
    let result
    try {
      result = indicator.run(window, paramValues)
    } catch {
      continue
    }

    const price = candles[i].close
    const time = candles[i].time

    if (result.series) {
      for (const [key, arr] of Object.entries(result.series)) {
        if (!seriesAccumulator[key]) seriesAccumulator[key] = []
        const v = arr[arr.length - 1]
        if (typeof v === 'number' && !Number.isNaN(v)) {
          seriesAccumulator[key].push({ time, value: v })
        }
      }
    }

    if (result.signal !== 'HOLD') {
      points.push({ time, price, signal: result.signal })
    }

    // Manage open trade: check SL/TP first, then signal-based exit/flip
    if (openTrade) {
      const sl = opts.slPercent
      const tp = opts.tpPercent
      const entry = openTrade.entryPrice
      const pctMove = openTrade.side === 'LONG' ? (price - entry) / entry : (entry - price) / entry

      let shouldExit = false
      let reason: BacktestTrade['exitReason'] = null

      if (sl && pctMove <= -sl / 100) {
        shouldExit = true
        reason = 'SL'
      } else if (tp && pctMove >= tp / 100) {
        shouldExit = true
        reason = 'TP'
      } else if (
        (openTrade.side === 'LONG' && result.signal === 'SELL') ||
        (openTrade.side === 'SHORT' && result.signal === 'BUY')
      ) {
        shouldExit = true
        reason = 'SIGNAL'
      }

      if (shouldExit) {
        openTrade.exitTime = time
        openTrade.exitPrice = price
        openTrade.pnlPct = pctMove * 100
        openTrade.exitReason = reason
        trades.push(openTrade)
        openTrade = null
      }
    }

    if (!openTrade && result.signal !== 'HOLD') {
      openTrade = {
        entryTime: time,
        entryPrice: price,
        exitTime: null,
        exitPrice: null,
        side: result.signal === 'BUY' ? 'LONG' : 'SHORT',
        pnlPct: null,
        exitReason: 'OPEN',
      }
    }
  }

  if (openTrade) trades.push(openTrade)

  const stats = computeStats(trades)

  return { points, trades, stats, series: seriesAccumulator }
}

function computeStats(trades: BacktestTrade[]): BacktestStats {
  const closed = trades.filter((t) => t.pnlPct !== null)
  if (closed.length === 0) {
    return {
      totalTrades: trades.length,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      maxDrawdownPct: 0,
      bestTradePct: 0,
      worstTradePct: 0,
    }
  }

  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0)
  const totalPnl = closed.reduce((acc, t) => acc + (t.pnlPct ?? 0), 0)

  let equity = 0
  let peak = 0
  let maxDrawdown = 0
  for (const t of closed) {
    equity += t.pnlPct ?? 0
    peak = Math.max(peak, equity)
    maxDrawdown = Math.min(maxDrawdown, equity - peak)
  }

  const pnlValues = closed.map((t) => t.pnlPct ?? 0)

  return {
    totalTrades: trades.length,
    winRate: (wins.length / closed.length) * 100,
    avgPnlPct: totalPnl / closed.length,
    totalPnlPct: totalPnl,
    maxDrawdownPct: maxDrawdown,
    bestTradePct: Math.max(...pnlValues),
    worstTradePct: Math.min(...pnlValues),
  }
}
