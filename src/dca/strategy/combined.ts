import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

import type { ExchangeIntervals, TradeResponse } from '../../types'

import { timeIntervalMap } from '../../types'

class CombinedStrategy extends Strategy implements StrategyInterface {
  private strategies: StrategyInterface[] = []

  private i = 0

  private total = 0

  private step = 0

  constructor(
    input: StrategyInput,
    ...strategies: ((args: StrategyInput) => StrategyInterface)[]
  ) {
    Strategy.resetData()
    super(input)
    this.strategies = strategies.map((s) => s(input))
  }

  public async test(
    updateProgress?: (value: number, text: string) => void,
  ): Promise<void> {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    let i = 0
    for (const b of lowest.bar) {
      await this.processBar(
        b,
        lowest.bar[i + 1],
        updateProgress,
        lowest.bar.length,
      )
      i++
    }
  }

  public async processBar(
    b: Bar,
    nextBar: Bar,
    updateProgress?: (value: number, text: string) => void,
    _size?: number,
  ): Promise<void> {
    const size = _size || Strategy?.data?.[0]?.bar?.length || 0
    if (this.step === 0 && this.total === 0 && updateProgress) {
      updateProgress(
        0,
        `Processing candle on ${new Date(b.time).toUTCString()}`,
      )
    }
    if (size !== 0 && updateProgress) {
      if (this.step === 0) {
        this.step = Math.floor(size * 0.03)
      }
      if (this.total === 0) {
        this.total = size
      }

      if (this.math.remainder(this.i, this.step) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 15))
        updateProgress(
          this.i / this.total,
          `Processing candle on ${new Date(b.time).toUTCString()}`,
        )
      }
      this.i++
    }
    for (const s of this.strategies) {
      if (this._stop) {
        return
      }
      await s.processBar(b, nextBar)
    }
  }

  public passTradeCandleData(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ) {
    this.processTrade(trade, candles)
  }

  public processTrade(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ): void {
    for (const s of this.strategies) {
      if (this._stop) {
        return
      }
      s.processTrade(trade, candles)
    }
  }

  public override getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    const map: Map<ExchangeIntervals, number> = new Map()
    for (const s of this.strategies) {
      for (const i of s.getOtherIntervals()) {
        map.set(i.interval, Math.max(map.get(i.interval) ?? 0, i.countBack))
      }
    }
    return Array.from(map).map(([k, v]) => ({ interval: k, countBack: v }))
  }
}

export default CombinedStrategy
