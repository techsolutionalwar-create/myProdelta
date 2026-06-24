import { useEffect, useRef } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { BacktestSignalPoint, Candle } from '@/types'

interface SignalChartProps {
  candles: Candle[]
  signals?: BacktestSignalPoint[]
  overlaySeries?: Record<string, { time: number; value: number }[]>
  height?: number
}

const OVERLAY_COLORS = ['#00d4ff', '#ffb020', '#a78bfa', '#34d399', '#f472b6']

export default function SignalChart({ candles, signals = [], overlaySeries = {}, height = 420 }: SignalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b91a1',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#161924' },
        horzLines: { color: '#161924' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#222530' },
      timeScale: { borderColor: '#222530', timeVisible: true, secondsVisible: false },
      autoSize: true,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#1fd67a',
      downColor: '#ff4d6a',
      borderVisible: false,
      wickUpColor: '#1fd67a',
      wickDownColor: '#ff4d6a',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      lineSeriesRefs.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return
    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    )
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  useEffect(() => {
    if (!candleSeriesRef.current) return
    const markers: SeriesMarker<Time>[] = signals.map((s) => ({
      time: s.time as Time,
      position: s.signal === 'BUY' ? 'belowBar' : 'aboveBar',
      color: s.signal === 'BUY' ? '#1fd67a' : '#ff4d6a',
      shape: s.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: s.signal,
    }))
    candleSeriesRef.current.setMarkers(markers)
  }, [signals])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    for (const [key, series] of lineSeriesRefs.current.entries()) {
      if (!(key in overlaySeries)) {
        chart.removeSeries(series)
        lineSeriesRefs.current.delete(key)
      }
    }

    let colorIdx = 0
    for (const [key, points] of Object.entries(overlaySeries)) {
      let series = lineSeriesRefs.current.get(key)
      if (!series) {
        series = chart.addLineSeries({
          color: OVERLAY_COLORS[colorIdx % OVERLAY_COLORS.length],
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        lineSeriesRefs.current.set(key, series)
      }
      series.setData(points.map((p) => ({ time: p.time as Time, value: p.value })))
      colorIdx++
    }
  }, [overlaySeries])

  return <div ref={containerRef} style={{ height }} className="w-full" />
}
