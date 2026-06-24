import type { Candle } from '@/types'

// ─── Basic series helpers ──────────────────────────────────────────────────

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
}
export function highs(candles: Candle[]): number[] {
  return candles.map((c) => c.high)
}
export function lows(candles: Candle[]): number[] {
  return candles.map((c) => c.low)
}
export function volumes(candles: Candle[]): number[] {
  return candles.map((c) => c.volume)
}

function nan(len: number): number[] {
  return new Array(len).fill(NaN)
}

// ─── SMA ───────────────────────────────────────────────────────────────────

export function sma(values: number[], period: number): number[] {
  const out = nan(values.length)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

// ─── EMA ───────────────────────────────────────────────────────────────────

export function ema(values: number[], period: number): number[] {
  const out = nan(values.length)
  const k = 2 / (period + 1)
  let prev: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (Number.isNaN(values[i])) continue
    if (prev === null) {
      // seed with SMA of first `period` values once we have enough
      if (i >= period - 1) {
        const seedSlice = values.slice(i - period + 1, i + 1)
        prev = seedSlice.reduce((a, b) => a + b, 0) / period
        out[i] = prev
      }
    } else {
      prev = values[i] * k + prev * (1 - k)
      out[i] = prev
    }
  }
  return out
}

// ─── RSI (Wilder's smoothing) ──────────────────────────────────────────────

export function rsi(values: number[], period = 14): number[] {
  const out = nan(values.length)
  if (values.length < period + 1) return out

  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gainSum += diff
    else lossSum -= diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

// ─── MACD ──────────────────────────────────────────────────────────────────

export interface MacdResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdResult {
  const emaFast = ema(values, fast)
  const emaSlow = ema(values, slow)
  const macdLine = values.map((_, i) =>
    Number.isNaN(emaFast[i]) || Number.isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  )
  const signalLine = ema(macdLine, signalPeriod)
  const histogram = macdLine.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signalLine[i]) ? NaN : v - signalLine[i]
  )
  return { macd: macdLine, signal: signalLine, histogram }
}

// ─── Bollinger Bands ───────────────────────────────────────────────────────

export interface BollingerResult {
  upper: number[]
  middle: number[]
  lower: number[]
}

export function bollingerBands(values: number[], period = 20, stdDevMult = 2): BollingerResult {
  const middle = sma(values, period)
  const upper = nan(values.length)
  const lower = nan(values.length)
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const mean = middle[i]
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    upper[i] = mean + stdDevMult * sd
    lower[i] = mean - stdDevMult * sd
  }
  return { upper, middle, lower }
}

// ─── ATR ───────────────────────────────────────────────────────────────────

export function atr(candles: Candle[], period = 14): number[] {
  const trueRanges: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const prevClose = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
  })
  // Wilder smoothing, same shape as RSI
  const out = nan(candles.length)
  if (trueRanges.length < period) return out
  let avg = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = avg
  for (let i = period; i < trueRanges.length; i++) {
    avg = (avg * (period - 1) + trueRanges[i]) / period
    out[i] = avg
  }
  return out
}

// ─── Supertrend ────────────────────────────────────────────────────────────

export interface SupertrendResult {
  value: number[]
  direction: ('up' | 'down' | null)[] // 'up' = bullish trend (support below price)
}

export function supertrend(candles: Candle[], period = 10, multiplier = 3): SupertrendResult {
  const atrVals = atr(candles, period)
  const hl2 = candles.map((c) => (c.high + c.low) / 2)
  const upperBand = nan(candles.length)
  const lowerBand = nan(candles.length)
  const value = nan(candles.length)
  const direction: ('up' | 'down' | null)[] = new Array(candles.length).fill(null)

  for (let i = 0; i < candles.length; i++) {
    if (Number.isNaN(atrVals[i])) continue
    const basicUpper = hl2[i] + multiplier * atrVals[i]
    const basicLower = hl2[i] - multiplier * atrVals[i]

    const prevUpper = upperBand[i - 1]
    const prevLower = lowerBand[i - 1]
    const prevClose = i > 0 ? candles[i - 1].close : NaN

    upperBand[i] =
      !Number.isNaN(prevUpper) && (basicUpper < prevUpper || prevClose > prevUpper)
        ? basicUpper
        : Number.isNaN(prevUpper)
        ? basicUpper
        : Math.min(basicUpper, prevUpper)

    lowerBand[i] =
      !Number.isNaN(prevLower) && (basicLower > prevLower || prevClose < prevLower)
        ? basicLower
        : Number.isNaN(prevLower)
        ? basicLower
        : Math.max(basicLower, prevLower)

    const close = candles[i].close
    const prevDir = i > 0 ? direction[i - 1] : null

    if (prevDir === null) {
      direction[i] = close <= upperBand[i] ? 'down' : 'up'
    } else if (prevDir === 'up') {
      direction[i] = close < lowerBand[i] ? 'down' : 'up'
    } else {
      direction[i] = close > upperBand[i] ? 'up' : 'down'
    }

    value[i] = direction[i] === 'up' ? lowerBand[i] : upperBand[i]
  }

  return { value, direction }
}

// ─── VWAP (session-cumulative, resets are caller's responsibility) ────────

export function vwap(candles: Candle[]): number[] {
  const out = nan(candles.length)
  let cumPV = 0
  let cumVol = 0
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3
    cumPV += typicalPrice * candles[i].volume
    cumVol += candles[i].volume
    out[i] = cumVol === 0 ? NaN : cumPV / cumVol
  }
  return out
}

// ─── Heikin-Ashi ───────────────────────────────────────────────────────────

export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2
    const haHigh = Math.max(c.high, haOpen, haClose)
    const haLow = Math.min(c.low, haOpen, haClose)
    out.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: c.volume })
  }
  return out
}

// ─── Crossover detection ───────────────────────────────────────────────────
// Returns true only on the bar where `a` crosses from <= b to > b (cross up)

export function crossOver(a: number[], b: number[], i?: number): boolean {
  const idx = i ?? a.length - 1
  if (idx < 1) return false
  const aPrev = a[idx - 1]
  const aCurr = a[idx]
  const bPrev = Array.isArray(b) ? b[idx - 1] : b
  const bCurr = Array.isArray(b) ? b[idx] : b
  if ([aPrev, aCurr, bPrev, bCurr].some((v) => Number.isNaN(v))) return false
  return aPrev <= bPrev && aCurr > bCurr
}

export function crossUnder(a: number[], b: number[], i?: number): boolean {
  const idx = i ?? a.length - 1
  if (idx < 1) return false
  const aPrev = a[idx - 1]
  const aCurr = a[idx]
  const bPrev = Array.isArray(b) ? b[idx - 1] : b
  const bCurr = Array.isArray(b) ? b[idx] : b
  if ([aPrev, aCurr, bPrev, bCurr].some((v) => Number.isNaN(v))) return false
  return aPrev >= bPrev && aCurr < bCurr
}

// ─── Bundle exposed to user indicator sandbox ─────────────────────────────

export const indicatorHelpers = {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  atr,
  supertrend,
  vwap,
  heikinAshi,
  crossOver,
  crossUnder,
  closes,
  highs,
  lows,
  volumes,
}

export type IndicatorHelpers = typeof indicatorHelpers
