/**
 * Best-effort Pine Script (v4/v5) → JS indicator converter.
 *
 * This is intentionally NOT a real parser. Pine Script has its own type
 * system, series semantics, and built-in drawing/strategy APIs that don't
 * map 1:1 onto a stateless `run(candles, params, helpers)` function. What
 * this does instead is pattern-match the handful of idioms that show up in
 * 90% of simple public indicators (ta.ema, ta.sma, ta.rsi, crossover/under,
 * plot, input.int, strategy.entry) and rewrite them into the closest JS
 * equivalent using our helper bundle.
 *
 * Anything it doesn't recognize is left as a commented TODO line so the
 * user can see exactly what needs manual porting rather than silently
 * producing wrong logic.
 */

export interface PineConversionResult {
  code: string
  warnings: string[]
  unconvertedLines: string[]
}

interface Replacement {
  pattern: RegExp
  replace: (match: RegExpMatchArray) => string
  note?: string
}

const inputDeclPattern = /(\w+)\s*=\s*input(?:\.(int|float|bool))?\s*\(\s*([^,]+)\s*(?:,\s*(?:title\s*=\s*)?["']([^"']*)["'])?/g

function extractInputsAsParams(pine: string): { paramsBlock: string; varNames: string[] } {
  const params: string[] = []
  const varNames: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(inputDeclPattern)
  while ((match = re.exec(pine)) !== null) {
    const [, varName, kind, defaultRaw, title] = match
    varNames.push(varName)
    const isBool = kind === 'bool' || /true|false/.test(defaultRaw)
    const defaultVal = isBool ? defaultRaw.trim() : defaultRaw.trim()
    if (isBool) {
      params.push(`  ${varName}: { default: ${defaultVal}, label: '${title || varName}' },`)
    } else {
      const num = parseFloat(defaultVal)
      const guessMin = Number.isFinite(num) ? Math.max(0, Math.floor(num / 2)) : 0
      const guessMax = Number.isFinite(num) ? Math.ceil(num * 4) : 100
      params.push(
        `  ${varName}: { default: ${Number.isFinite(num) ? num : 0}, min: ${guessMin}, max: ${guessMax}, step: 1, label: '${
          title || varName
        }' },`
      )
    }
  }
  return { paramsBlock: params.join('\n'), varNames }
}

const lineReplacements: Replacement[] = [
  {
    pattern: /ta\.ema\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g,
    replace: (m) => `ema(closes(candles), ${m[2]})`,
  },
  {
    pattern: /ta\.sma\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g,
    replace: (m) => `sma(closes(candles), ${m[2]})`,
  },
  {
    pattern: /ta\.rsi\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g,
    replace: (m) => `rsi(closes(candles), ${m[2]})`,
  },
  {
    pattern: /ta\.atr\s*\(\s*([\w.]+)\s*\)/g,
    replace: () => `atr(candles)`,
  },
  {
    pattern: /ta\.vwap\s*\(\s*([\w.]+)\s*\)/g,
    replace: () => `vwap(candles)`,
  },
  {
    pattern: /ta\.crossover\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g,
    replace: (m) => `crossOver(${m[1]}, ${m[2]}, i)`,
  },
  {
    pattern: /ta\.crossunder\s*\(\s*([\w.]+)\s*,\s*([\w.]+)\s*\)/g,
    replace: (m) => `crossUnder(${m[1]}, ${m[2]}, i)`,
  },
  {
    pattern: /close\b/g,
    replace: () => `closes(candles)`,
    note: 'Replaced `close` series reference with closes(candles) — review usage, Pine series index differs from JS array index.',
  },
]

export function convertPineToJs(pineSource: string): PineConversionResult {
  const warnings: string[] = [
    'This is a BEST-EFFORT conversion. Pine Script and this JS engine have different execution models (Pine re-runs per bar; this engine computes whole series at once). Review the logic carefully before activating live.',
  ]
  const unconvertedLines: string[] = []

  const lines = pineSource.split('\n')
  const bodyLines: string[] = []

  const { paramsBlock, varNames } = extractInputsAsParams(pineSource)
  if (varNames.length > 0) {
    warnings.push(`Converted ${varNames.length} input.*() declaration(s) into the params object: ${varNames.join(', ')}`)
  }

  let sawStrategyCall = false
  let sawPlotCall = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue
    if (/^\/\/@version/.test(line)) continue
    if (/^(indicator|strategy)\s*\(/.test(line)) continue
    if (/^input/.test(line) || /=\s*input/.test(line)) continue // already pulled into params

    if (/strategy\.(entry|close|exit)/.test(line)) {
      sawStrategyCall = true
      unconvertedLines.push(rawLine)
      bodyLines.push(`  // TODO manual port — strategy call: ${line}`)
      continue
    }
    if (/^plot\s*\(/.test(line)) {
      sawPlotCall = true
      continue // plotting has no JS equivalent here; series go in `series:` return field instead
    }

    let converted = line
    let matchedAny = false
    for (const rule of lineReplacements) {
      rule.pattern.lastIndex = 0 // global regexes are stateful across calls — reset before each test
      if (rule.pattern.test(converted)) {
        matchedAny = true
        rule.pattern.lastIndex = 0
        converted = converted.replace(rule.pattern, (...args) => rule.replace(args as unknown as RegExpMatchArray))
        if (rule.note) warnings.push(rule.note)
      }
    }

    if (!matchedAny && /[:=]/.test(line) === false) {
      // likely a bare expression / comment-like line we can't map
      unconvertedLines.push(rawLine)
      bodyLines.push(`  // TODO manual port: ${line}`)
      continue
    }

    bodyLines.push(`  let ${converted.endsWith(';') ? converted : converted + ';'}`)
  }

  if (sawStrategyCall) {
    warnings.push('Pine `strategy.*()` calls were found — these control order placement in TradingView and have no direct equivalent here. They were left as TODO comments; express your entry/exit logic via the returned `signal` instead.')
  }
  if (sawPlotCall) {
    warnings.push('Pine `plot()` calls were dropped — return any series you want to chart via the `series: { ... }` field in the result object instead.')
  }

  const code = `// ════════════════════════════════════════════════════════════════════════
// Auto-converted from Pine Script — REVIEW BEFORE USING
// ${warnings.length} warning(s) below. Search for "TODO manual port" for
// lines that could not be auto-converted.
// ════════════════════════════════════════════════════════════════════════

const params = {
${paramsBlock || '  // no input.*() declarations were detected'}
}

function run(candles, params, helpers) {
  const { ema, sma, rsi, macd, bollingerBands, atr, supertrend, vwap, heikinAshi, crossOver, crossUnder, closes, highs, lows, volumes } = helpers
  const i = candles.length - 1

${bodyLines.join('\n')}

  // TODO: set the final signal based on the converted logic above.
  let signal = 'HOLD'

  return { signal, value: null, value2: null }
}
`

  return { code, warnings, unconvertedLines }
}
