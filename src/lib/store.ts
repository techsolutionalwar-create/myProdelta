import { create } from 'zustand'
import type {
  AppSettings,
  BotConfig,
  Position,
  SavedIndicator,
  TradeLogEntry,
  WalletBalance,
} from '@/types'
import { createDeltaClient, DELTA_BASE_URL } from './deltaApi'
import { db } from './db'

const SETTINGS_KEY = 'delta-quant-bot:settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt settings
  }
  return {
    credentials: null,
    defaultSymbol: 'BTCUSD',
    defaultResolution: '5m',
    pollIntervalSec: 30,
    theme: 'dark',
  }
}

function persistSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

interface AppState {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void

  indicators: SavedIndicator[]
  refreshIndicators: () => Promise<void>
  activeIndicatorId: string | null
  setActiveIndicatorId: (id: string | null) => void

  bots: BotConfig[]
  refreshBots: () => Promise<void>

  positions: Position[]
  balances: WalletBalance[]
  setPositions: (p: Position[]) => void
  setBalances: (b: WalletBalance[]) => void

  tradeLog: TradeLogEntry[]
  refreshTradeLog: () => Promise<void>

  connectionStatus: 'unconfigured' | 'connected' | 'error'
  connectionError: string | null
  setConnectionStatus: (s: 'unconfigured' | 'connected' | 'error', err?: string | null) => void

  dailyPnlUsd: number
  setDailyPnlUsd: (v: number) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: loadSettings(),
  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    persistSettings(next)
    set({ settings: next })
  },

  indicators: [],
  refreshIndicators: async () => {
    const list = await db.indicators.orderBy('updatedAt').reverse().toArray()
    set({ indicators: list })
  },
  activeIndicatorId: null,
  setActiveIndicatorId: (id) => set({ activeIndicatorId: id }),

  bots: [],
  refreshBots: async () => {
    const list = await db.bots.toArray()
    set({ bots: list })
  },

  positions: [],
  balances: [],
  setPositions: (p) => set({ positions: p }),
  setBalances: (b) => set({ balances: b }),

  tradeLog: [],
  refreshTradeLog: async () => {
    const list = await db.tradeLog.orderBy('timestamp').reverse().limit(200).toArray()
    set({ tradeLog: list })
  },

  connectionStatus: 'unconfigured',
  connectionError: null,
  setConnectionStatus: (s, err = null) => set({ connectionStatus: s, connectionError: err }),

  dailyPnlUsd: 0,
  setDailyPnlUsd: (v) => set({ dailyPnlUsd: v }),
}))

export function getDeltaClient() {
  const { settings } = useAppStore.getState()
  return createDeltaClient(settings.credentials)
}

export function getDefaultBaseUrl() {
  return DELTA_BASE_URL
}
