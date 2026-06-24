// ─── Market Data ──────────────────────────────────────────────────────────

export interface Candle {
  time: number // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Ticker {
  symbol: string
  close: number
  mark_price: number
  open: number
  high: number
  low: number
  volume: number
  change_24h: number
  timestamp: number
}

// ─── Indicator Engine ──────────────────────────────────────────────────────

export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface IndicatorResult {
  signal: SignalType
  value: number | null
  value2?: number | null
  series?: Record<string, number[]> // optional named series for plotting (e.g. ema_fast, ema_slow)
  meta?: Record<string, unknown>
}

export type IndicatorParamType = 'number' | 'boolean' | 'select'

export interface IndicatorParamDef {
  type: IndicatorParamType
  default: number | boolean | string
  min?: number
  max?: number
  step?: number
  options?: string[]
  label?: string
}

export type IndicatorParams = Record<string, IndicatorParamDef>

export interface SavedIndicator {
  id: string
  name: string
  description?: string
  code: string
  params: Record<string, number | boolean | string> // current param values
  paramDefs: IndicatorParams // defs extracted from code's `params` object
  createdAt: number
  updatedAt: number
  source: 'manual' | 'pine-converted'
}

export interface BacktestSignalPoint {
  time: number
  price: number
  signal: SignalType
}

export interface BacktestResult {
  points: BacktestSignalPoint[]
  trades: BacktestTrade[]
  stats: BacktestStats
  series: Record<string, { time: number; value: number }[]>
}

export interface BacktestTrade {
  entryTime: number
  entryPrice: number
  exitTime: number | null
  exitPrice: number | null
  side: 'LONG' | 'SHORT'
  pnlPct: number | null
  exitReason: 'SIGNAL' | 'SL' | 'TP' | 'OPEN' | null
}

export interface BacktestStats {
  totalTrades: number
  winRate: number
  avgPnlPct: number
  totalPnlPct: number
  maxDrawdownPct: number
  bestTradePct: number
  worstTradePct: number
}

// ─── Trading / Risk ────────────────────────────────────────────────────────

export type TradingMode = 'paper' | 'live'

export interface RiskSettings {
  positionSizeUsd: number
  leverage: number
  slPercent: number
  tpPercent: number
  dailyLossLimitUsd: number
  maxOpenPositions: number
}

export interface BotConfig {
  id: string
  indicatorId: string
  symbol: string
  resolution: string // '1m' | '5m' | '15m' | '1h' etc
  mode: TradingMode
  risk: RiskSettings
  isActive: boolean
  createdAt: number
}

export interface Position {
  symbol: string
  size: number
  side: 'long' | 'short'
  entryPrice: number
  markPrice: number
  liquidationPrice: number | null
  unrealizedPnl: number
  marginUsed: number
  leverage: number
}

export interface WalletBalance {
  asset: string
  balance: number
  availableBalance: number
}

export type OrderSide = 'buy' | 'sell'

export interface PlaceOrderRequest {
  symbol: string
  side: OrderSide
  size: number
  orderType: 'market_order' | 'limit_order'
  limitPrice?: number
  bracketStopLossPrice?: number
  bracketTakeProfitPrice?: number
  reduceOnly?: boolean
}

export interface TradeLogEntry {
  id: string
  timestamp: number
  symbol: string
  side: OrderSide
  size: number
  price: number
  mode: TradingMode
  indicatorName: string
  reason: string
  status: 'FILLED' | 'REJECTED' | 'PENDING' | 'PAPER_FILLED'
  pnl?: number
  errorMessage?: string
}

// ─── Delta Exchange API shapes (subset) ───────────────────────────────────

export interface DeltaProduct {
  id: number
  symbol: string
  description: string
  contract_type: string
  tick_size: string
  underlying_asset: { symbol: string }
}

export interface ApiCredentials {
  apiKey: string
  apiSecret: string
  baseUrl: string // api.india.delta.exchange or testnet
}

export interface AppSettings {
  credentials: ApiCredentials | null
  defaultSymbol: string
  defaultResolution: string
  pollIntervalSec: number
  theme: 'dark'
}
