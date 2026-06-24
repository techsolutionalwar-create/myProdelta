// This file exports the default indicator source as a STRING — it is the
// text that gets preloaded into the Monaco editor, then compiled at runtime
// by indicatorRunner.ts via `new Function(...)`. It is not imported/executed
// directly as a TS module.

export const DEFAULT_INDICATOR_NAME = 'EMA + RSI Combo'

export const DEFAULT_INDICATOR_CODE = `// ════════════════════════════════════════════════════════════════════════
// EMA + RSI Combo — Default Template
// ────────────────────────────────────────────────────────────────────────
// BUY  when fast EMA crosses above slow EMA AND RSI is below the
//      overbought line (room left to run).
// SELL when fast EMA crosses below slow EMA AND RSI is above the
//      oversold line.
// Edit the params below — sliders are generated automatically from
// min / max / step. Edit the run() function to change the logic.
//
// Available helpers: sma, ema, rsi, macd, bollingerBands, atr, supertrend,
// vwap, heikinAshi, crossOver, crossUnder, closes, highs, lows, volumes
// ════════════════════════════════════════════════════════════════════════

const params = {
  emaFast:       { default: 9,  min: 2,  max: 50,  step: 1, label: 'EMA Fast' },
  emaSlow:       { default: 21, min: 5,  max: 200, step: 1, label: 'EMA Slow' },
  rsiPeriod:     { default: 14, min: 2,  max: 50,  step: 1, label: 'RSI Period' },
  rsiOverbought: { default: 70, min: 50, max: 90,  step: 1, label: 'RSI Overbought' },
  rsiOversold:   { default: 30, min: 10, max: 50,  step: 1, label: 'RSI Oversold' },
}

function run(candles, params, helpers) {
  const { ema, rsi, crossOver, crossUnder, closes } = helpers

  const closePrices = closes(candles)
  const fastLine = ema(closePrices, params.emaFast)
  const slowLine = ema(closePrices, params.emaSlow)
  const rsiLine = rsi(closePrices, params.rsiPeriod)

  const i = candles.length - 1
  const lastRsi = rsiLine[i]

  let signal = 'HOLD'

  if (crossOver(fastLine, slowLine, i) && lastRsi < params.rsiOverbought) {
    signal = 'BUY'
  } else if (crossUnder(fastLine, slowLine, i) && lastRsi > params.rsiOversold) {
    signal = 'SELL'
  }

  return {
    signal,
    value: fastLine[i],
    value2: slowLine[i],
    series: {
      ema_fast: fastLine,
      ema_slow: slowLine,
      rsi: rsiLine,
    },
  }
}
`
