import CryptoJS from 'crypto-js'
import type {
  ApiCredentials,
  Candle,
  DeltaProduct,
  PlaceOrderRequest,
  Position,
  Ticker,
  WalletBalance,
} from '@/types'

export const DELTA_BASE_URL = 'https://api.india.delta.exchange'

export class DeltaApiError extends Error {
  status?: number
  body?: unknown
  constructor(message: string, status?: number, body?: unknown) {
    super(message)
    this.name = 'DeltaApiError'
    this.status = status
    this.body = body
  }
}

/**
 * Delta's signature scheme (confirmed against official docs):
 *   signature_data = method + timestamp + path + query_string + body
 *   signature = HMAC_SHA256(signature_data, api_secret) as hex
 * Headers: api-key, timestamp, signature
 *
 * The timestamp is Unix seconds and the signature is only valid for ~5
 * seconds on Delta's servers (replay-attack protection) — that's why we
 * compute a fresh timestamp/signature on every single request rather than
 * caching one.
 *
 * IMPORTANT: this is computed client-side, which means your API SECRET
 * lives in browser memory/localStorage. Delta's own docs explicitly warn
 * "never share your API secret or include it in client-side code" — this
 * project does so anyway for the sake of being a zero-backend, fully
 * client-side hobby tool. That's an acceptable tradeoff ONLY if you run it
 * yourself on localhost or a private deployment only you can reach. Never
 * deploy a build of this app to a public URL with your real secret typed
 * into it, and never give anyone else access to that deployed instance.
 */
function buildSignature(secret: string, method: string, timestamp: string, path: string, query: string, body: string): string {
  const payload = method + timestamp + path + query + body
  return CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | undefined>
  body?: Record<string, unknown>
}

function buildQueryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return ''
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export class DeltaClient {
  constructor(private creds: ApiCredentials) {}

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const method = opts.method ?? 'GET'
    const queryString = buildQueryString(opts.query)
    const bodyString = opts.body ? JSON.stringify(opts.body) : ''
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const signature = buildSignature(
      this.creds.apiSecret,
      method,
      timestamp,
      path,
      queryString,
      bodyString
    )

    const url = `${this.creds.baseUrl}${path}${queryString}`

    const res = await fetch(url, {
      method,
      headers: {
        'api-key': this.creds.apiKey,
        timestamp,
        signature,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: bodyString || undefined,
    })

    const json = await res.json().catch(() => null)

    if (!res.ok || json?.success === false) {
      const msg = json?.error?.message || json?.message || `Delta API request failed (${res.status})`
      throw new DeltaApiError(msg, res.status, json)
    }

    return (json?.result ?? json) as T
  }

  // ─── Public/market data ────────────────────────────────────────────────

  async getCandles(symbol: string, resolution: string, count = 500): Promise<Candle[]> {
    const nowSec = Math.floor(Date.now() / 1000)
    const resolutionToSec: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '1d': 86400,
    }
    const stepSec = resolutionToSec[resolution] ?? 60
    const start = nowSec - stepSec * count

    const raw = await this.request<any>('/v2/history/candles', {
      query: {
        resolution,
        symbol,
        start: start.toString(),
        end: nowSec.toString(),
      },
    })

    const rows: any[] = Array.isArray(raw) ? raw : raw?.result ?? []
    return rows
      .map((r) => ({
        time: r.time ?? r.t,
        open: Number(r.open ?? r.o),
        high: Number(r.high ?? r.h),
        low: Number(r.low ?? r.l),
        close: Number(r.close ?? r.c),
        volume: Number(r.volume ?? r.v ?? 0),
      }))
      .sort((a, b) => a.time - b.time)
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const raw = await this.request<any>(`/v2/tickers/${symbol}`)
    return {
      symbol: raw.symbol ?? symbol,
      close: Number(raw.close ?? raw.mark_price ?? 0),
      mark_price: Number(raw.mark_price ?? 0),
      open: Number(raw.open ?? 0),
      high: Number(raw.high ?? 0),
      low: Number(raw.low ?? 0),
      volume: Number(raw.volume ?? 0),
      change_24h: Number(raw.mark_change_24h ?? raw.change_24h ?? 0),
      timestamp: Date.now(),
    }
  }

  async getProducts(): Promise<DeltaProduct[]> {
    const raw = await this.request<any[]>('/v2/products', { query: { contract_types: 'perpetual_futures' } })
    return raw
  }

  // ─── Authenticated: account ────────────────────────────────────────────

  async getBalances(): Promise<WalletBalance[]> {
    const raw = await this.request<any[]>('/v2/wallet/balances')
    return raw.map((b) => ({
      asset: b.asset_symbol ?? b.asset?.symbol ?? 'USD',
      balance: Number(b.balance ?? 0),
      availableBalance: Number(b.available_balance ?? b.balance ?? 0),
    }))
  }

  async getPositions(): Promise<Position[]> {
    const raw = await this.request<any[]>('/v2/positions/margined')
    return raw
      .filter((p) => Number(p.size) !== 0)
      .map((p) => ({
        symbol: p.product?.symbol ?? p.product_symbol ?? '',
        size: Number(p.size),
        side: Number(p.size) > 0 ? 'long' : 'short',
        entryPrice: Number(p.entry_price ?? 0),
        markPrice: Number(p.mark_price ?? 0),
        liquidationPrice: p.liquidation_price ? Number(p.liquidation_price) : null,
        unrealizedPnl: Number(p.unrealized_pnl ?? 0),
        marginUsed: Number(p.margin ?? 0),
        leverage: Number(p.leverage ?? 1),
      }))
  }

  // ─── Authenticated: orders ─────────────────────────────────────────────

  async placeOrder(req: PlaceOrderRequest): Promise<any> {
    // Delta's create-order endpoint accepts product_symbol as an alternative
    // to product_id, which saves us a round trip through /v2/products to
    // resolve the numeric id first. bracket_*_price sets a stop-market-style
    // exit; bracket_*_limit_price is set equal to the trigger here for
    // simplicity (a true stop-limit bracket would use a tighter limit).
    const body: Record<string, unknown> = {
      product_symbol: req.symbol,
      size: req.size,
      side: req.side,
      order_type: req.orderType,
    }
    if (req.orderType === 'limit_order' && req.limitPrice) body.limit_price = req.limitPrice.toString()
    if (req.bracketStopLossPrice) {
      body.bracket_stop_loss_price = req.bracketStopLossPrice.toString()
      body.bracket_stop_loss_limit_price = req.bracketStopLossPrice.toString()
    }
    if (req.bracketTakeProfitPrice) {
      body.bracket_take_profit_price = req.bracketTakeProfitPrice.toString()
      body.bracket_take_profit_limit_price = req.bracketTakeProfitPrice.toString()
    }
    if (req.reduceOnly) body.reduce_only = true

    return this.request('/v2/orders', { method: 'POST', body })
  }

  async cancelOrder(orderId: number, productId: number): Promise<any> {
    return this.request('/v2/orders', {
      method: 'DELETE',
      body: { id: orderId, product_id: productId },
    })
  }
}

export function createDeltaClient(creds: ApiCredentials | null): DeltaClient | null {
  if (!creds || !creds.apiKey || !creds.apiSecret) return null
  return new DeltaClient(creds)
}
