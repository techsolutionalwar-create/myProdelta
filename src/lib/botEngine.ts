import type { BotConfig, Candle, SavedIndicator, TradeLogEntry } from '@/types'
import { compileIndicator } from './indicatorRunner'
import { getDeltaClient, useAppStore } from './store'
import { appendTradeLog } from './db'

interface RunningBot {
  config: BotConfig
  indicator: SavedIndicator
  intervalId: number
  lastCandleTime: number | null
  dailyPnlUsd: number
  dailyLossLimitHit: boolean
  openPaperPosition: {
    side: 'long' | 'short'
    entryPrice: number
    size: number
    slPrice: number
    tpPrice: number
  } | null
}

class BotEngine {
  private running = new Map<string, RunningBot>()
  private listeners = new Set<() => void>()

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  isRunning(botId: string): boolean {
    return this.running.has(botId)
  }

  getRunningIds(): string[] {
    return Array.from(this.running.keys())
  }

  start(config: BotConfig, indicator: SavedIndicator) {
    if (this.running.has(config.id)) return

    const entry: RunningBot = {
      config,
      indicator,
      intervalId: 0,
      lastCandleTime: null,
      dailyPnlUsd: 0,
      dailyLossLimitHit: false,
      openPaperPosition: null,
    }

    const tick = () => this.runTick(entry).catch((err) => console.error('[bot tick error]', err))
    entry.intervalId = window.setInterval(tick, useAppStore.getState().settings.pollIntervalSec * 1000)
    this.running.set(config.id, entry)
    tick() // run immediately on start
    this.notify()
  }

  stop(botId: string) {
    const entry = this.running.get(botId)
    if (!entry) return
    window.clearInterval(entry.intervalId)
    this.running.delete(botId)
    this.notify()
  }

  stopAll() {
    for (const id of Array.from(this.running.keys())) this.stop(id)
  }

  private async runTick(entry: RunningBot) {
    const client = getDeltaClient()
    if (!client) {
      console.warn('[bot] no API client configured, skipping tick')
      return
    }

    if (entry.dailyLossLimitHit) return

    const candles: Candle[] = await client.getCandles(
      entry.config.symbol,
      entry.config.resolution,
      500
    )
    if (candles.length === 0) return

    const last = candles[candles.length - 1]
    if (entry.lastCandleTime === last.time) return // no new candle yet
    entry.lastCandleTime = last.time

    let compiled
    try {
      compiled = compileIndicator(entry.indicator.code)
    } catch (err) {
      console.error('[bot] indicator failed to compile', err)
      return
    }

    let result
    try {
      result = compiled.run(candles, entry.indicator.params)
    } catch (err) {
      console.error('[bot] indicator threw at runtime', err)
      return
    }

    const price = last.close
    const risk = entry.config.risk

    // Manage existing paper position (SL/TP check) before evaluating new entries
    if (entry.config.mode === 'paper' && entry.openPaperPosition) {
      const pos = entry.openPaperPosition
      const hitSl = pos.side === 'long' ? price <= pos.slPrice : price >= pos.slPrice
      const hitTp = pos.side === 'long' ? price >= pos.tpPrice : price <= pos.tpPrice
      const flipSignal =
        (pos.side === 'long' && result.signal === 'SELL') ||
        (pos.side === 'short' && result.signal === 'BUY')

      if (hitSl || hitTp || flipSignal) {
        const pnlPct = pos.side === 'long' ? (price - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - price) / pos.entryPrice
        const pnlUsd = pnlPct * risk.positionSizeUsd * risk.leverage
        entry.dailyPnlUsd += pnlUsd

        await this.log(entry, {
          side: pos.side === 'long' ? 'sell' : 'buy',
          price,
          status: 'PAPER_FILLED',
          reason: hitSl ? 'Paper SL hit' : hitTp ? 'Paper TP hit' : 'Signal flip — closing position',
          pnl: pnlUsd,
        })
        entry.openPaperPosition = null

        if (entry.dailyPnlUsd <= -Math.abs(risk.dailyLossLimitUsd)) {
          entry.dailyLossLimitHit = true
          await this.log(entry, {
            side: 'sell',
            price,
            status: 'REJECTED',
            reason: `Daily loss limit of $${risk.dailyLossLimitUsd} reached — bot paused for today`,
          })
          this.notify()
          return
        }
      }
    }

    if (result.signal === 'HOLD') {
      this.notify()
      return
    }

    if (entry.config.mode === 'paper') {
      if (!entry.openPaperPosition) {
        const side = result.signal === 'BUY' ? 'long' : 'short'
        const slPrice = side === 'long' ? price * (1 - risk.slPercent / 100) : price * (1 + risk.slPercent / 100)
        const tpPrice = side === 'long' ? price * (1 + risk.tpPercent / 100) : price * (1 - risk.tpPercent / 100)
        entry.openPaperPosition = { side, entryPrice: price, size: risk.positionSizeUsd, slPrice, tpPrice }

        await this.log(entry, {
          side: result.signal === 'BUY' ? 'buy' : 'sell',
          price,
          status: 'PAPER_FILLED',
          reason: `Paper entry on ${result.signal} signal`,
        })
      }
    } else {
      // LIVE mode — place a real bracket order
      try {
        const slPrice = result.signal === 'BUY' ? price * (1 - risk.slPercent / 100) : price * (1 + risk.slPercent / 100)
        const tpPrice = result.signal === 'BUY' ? price * (1 + risk.tpPercent / 100) : price * (1 - risk.tpPercent / 100)

        await client.placeOrder({
          symbol: entry.config.symbol,
          side: result.signal === 'BUY' ? 'buy' : 'sell',
          size: Math.max(1, Math.round(risk.positionSizeUsd / price)),
          orderType: 'market_order',
          bracketStopLossPrice: slPrice,
          bracketTakeProfitPrice: tpPrice,
        })

        await this.log(entry, {
          side: result.signal === 'BUY' ? 'buy' : 'sell',
          price,
          status: 'FILLED',
          reason: `Live order on ${result.signal} signal`,
        })
      } catch (err) {
        await this.log(entry, {
          side: result.signal === 'BUY' ? 'buy' : 'sell',
          price,
          status: 'REJECTED',
          reason: 'Order placement failed',
          errorMessage: (err as Error).message,
        })
      }
    }

    this.notify()
  }

  private async log(
    entry: RunningBot,
    partial: Pick<TradeLogEntry, 'side' | 'price' | 'status' | 'reason'> & { pnl?: number; errorMessage?: string }
  ) {
    const logEntry: TradeLogEntry = {
      id: `${entry.config.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      symbol: entry.config.symbol,
      side: partial.side,
      size: entry.config.risk.positionSizeUsd,
      price: partial.price,
      mode: entry.config.mode,
      indicatorName: entry.indicator.name,
      reason: partial.reason,
      status: partial.status,
      pnl: partial.pnl,
      errorMessage: partial.errorMessage,
    }
    await appendTradeLog(logEntry)
    useAppStore.getState().refreshTradeLog()
  }
}

export const botEngine = new BotEngine()
