import Dexie, { type Table } from 'dexie'
import type { SavedIndicator, TradeLogEntry, BotConfig } from '@/types'

class DeltaBotDB extends Dexie {
  indicators!: Table<SavedIndicator, string>
  tradeLog!: Table<TradeLogEntry, string>
  bots!: Table<BotConfig, string>

  constructor() {
    super('delta-quant-bot')
    this.version(1).stores({
      indicators: 'id, name, updatedAt',
      tradeLog: 'id, timestamp, symbol, mode',
      bots: 'id, symbol, isActive',
    })
  }
}

export const db = new DeltaBotDB()

// ─── Indicators ─────────────────────────────────────────────────────────

export async function saveIndicator(ind: SavedIndicator): Promise<void> {
  await db.indicators.put(ind)
}

export async function deleteIndicator(id: string): Promise<void> {
  await db.indicators.delete(id)
}

export async function listIndicators(): Promise<SavedIndicator[]> {
  return db.indicators.orderBy('updatedAt').reverse().toArray()
}

export function exportIndicatorAsJson(ind: SavedIndicator): string {
  return JSON.stringify(ind, null, 2)
}

export function parseIndicatorJson(json: string): SavedIndicator {
  const parsed = JSON.parse(json)
  if (!parsed.code || !parsed.name) {
    throw new Error('Invalid indicator JSON — missing `code` or `name` field')
  }
  return parsed as SavedIndicator
}

// ─── Trade log ──────────────────────────────────────────────────────────

export async function appendTradeLog(entry: TradeLogEntry): Promise<void> {
  await db.tradeLog.put(entry)
}

export async function listTradeLog(limit = 200): Promise<TradeLogEntry[]> {
  return db.tradeLog.orderBy('timestamp').reverse().limit(limit).toArray()
}

export async function clearTradeLog(): Promise<void> {
  await db.tradeLog.clear()
}

// ─── Bot configs ────────────────────────────────────────────────────────

export async function saveBotConfig(bot: BotConfig): Promise<void> {
  await db.bots.put(bot)
}

export async function listBotConfigs(): Promise<BotConfig[]> {
  return db.bots.toArray()
}

export async function deleteBotConfig(id: string): Promise<void> {
  await db.bots.delete(id)
}
