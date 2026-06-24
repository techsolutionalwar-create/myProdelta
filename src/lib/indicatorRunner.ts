import type { Candle, IndicatorParamDef, IndicatorResult } from '@/types'
import { indicatorHelpers } from './taLib'

/**
 * The user writes a function body in the Monaco editor that defines:
 *   - a `params` object (param name -> { type, default, min, max, step })
 *   - a `run(candles, params, helpers)` function returning IndicatorResult
 *
 * We execute this with `new Function(...)`, NOT eval, and with no access to
 * `window`, `document`, `fetch`, or any DOM/network global — the function
 * only receives the candle data, param values, and the math helper bundle.
 *
 * This is a best-effort sandbox suitable for a client-side hobby/personal-use
 * tool. It is NOT a security boundary against a malicious script — indicator
 * code still runs in the same JS realm as the page. Never paste in code you
 * don't trust or didn't write yourself.
 */

export interface CompiledIndicator {
  params: Record<string, IndicatorParamDef>
  run: (candles: Candle[], paramValues: Record<string, unknown>) => IndicatorResult
}

const FORBIDDEN_TOKENS = [
  'fetch(',
  'XMLHttpRequest',
  'document.',
  'window.',
  'localStorage',
  'sessionStorage',
  'import(',
  'require(',
  '__proto__',
  'constructor.constructor',
]

export class IndicatorCompileError extends Error {}
export class IndicatorRuntimeError extends Error {}

export function lintIndicatorCode(code: string): string[] {
  const warnings: string[] = []
  for (const token of FORBIDDEN_TOKENS) {
    if (code.includes(token)) {
      warnings.push(`Code contains a disallowed pattern: "${token}". This will be blocked at runtime.`)
    }
  }
  if (!/params\s*=/.test(code) && !/const\s+params/.test(code) && !/let\s+params/.test(code)) {
    warnings.push('No `params` object found. Add `const params = { ... }` to expose editable sliders.')
  }
  if (!/function\s+run\s*\(/.test(code) && !/run\s*=\s*\(/.test(code) && !/const\s+run/.test(code)) {
    warnings.push('No `run(candles, params, helpers)` function found.')
  }
  return warnings
}

export function compileIndicator(code: string): CompiledIndicator {
  for (const token of FORBIDDEN_TOKENS) {
    if (code.includes(token)) {
      throw new IndicatorCompileError(`Blocked: code contains disallowed pattern "${token}"`)
    }
  }

  // Wrap the user code so it must expose `params` and `run` via return statement.
  // We give it the helpers bundle as an argument named `helpers`, destructured
  // versions of each helper fn, and nothing else from the outer scope.
  const wrapped = `
    "use strict";
    ${code}
    if (typeof params === 'undefined') { throw new Error('params object is not defined'); }
    if (typeof run !== 'function') { throw new Error('run(candles, params, helpers) function is not defined'); }
    return { params, run };
  `

  let factory: (helpers: typeof indicatorHelpers) => { params: any; run: any }
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('helpers', wrapped) as (h: typeof indicatorHelpers) => any
    factory = fn
  } catch (err) {
    throw new IndicatorCompileError(`Syntax error: ${(err as Error).message}`)
  }

  let extracted: { params: any; run: any }
  try {
    extracted = factory(indicatorHelpers)
  } catch (err) {
    throw new IndicatorCompileError(`Failed to initialize: ${(err as Error).message}`)
  }

  const { params, run } = extracted

  const paramDefs: Record<string, IndicatorParamDef> = {}
  for (const [key, val] of Object.entries(params ?? {})) {
    const v = val as any
    paramDefs[key] = {
      type: typeof v.default === 'boolean' ? 'boolean' : v.options ? 'select' : 'number',
      default: v.default,
      min: v.min,
      max: v.max,
      step: v.step ?? 1,
      options: v.options,
      label: v.label ?? key,
    }
  }

  return {
    params: paramDefs,
    run: (candles: Candle[], paramValues: Record<string, unknown>): IndicatorResult => {
      try {
        const result = run(candles, paramValues, indicatorHelpers)
        if (!result || typeof result !== 'object' || !('signal' in result)) {
          throw new Error('run() must return an object with a `signal` field')
        }
        if (!['BUY', 'SELL', 'HOLD'].includes(result.signal)) {
          throw new Error(`Invalid signal "${result.signal}" — must be BUY, SELL, or HOLD`)
        }
        return {
          signal: result.signal,
          value: result.value ?? null,
          value2: result.value2 ?? null,
          series: result.series ?? undefined,
          meta: result.meta ?? undefined,
        }
      } catch (err) {
        throw new IndicatorRuntimeError(`run() threw: ${(err as Error).message}`)
      }
    },
  }
}

export function defaultParamValues(paramDefs: Record<string, IndicatorParamDef>): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {}
  for (const [key, def] of Object.entries(paramDefs)) {
    out[key] = def.default
  }
  return out
}
