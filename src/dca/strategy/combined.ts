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

  public test(updateProgress?: (value: number, text: string) => void): void {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    lowest.bar.forEach((b, i) =>
      this.processBar(b, lowest.bar[i + 1], updateProgress, lowest.bar.length),
    )
  }

  public processBar(
    b: Bar,
    nextBar: Bar,
    updateProgress?: (value: number, text: string) => void,
    _size?: number,
  ): void {
    const size = _size || Strategy?.data?.[0]?.bar?.length || 0
    if (this.step === 0 && this.total === 0 && updateProgress) {
      updateProgress(
        0,
        `Processing candle on ${new Date(b.time).toUTCString()}`,
      )
    }
    if (size !== 0 && updateProgress) {
      if (this.step === 0) {
        this.step = Math.floor(size * 0.01)
      }
      if (this.total === 0) {
        this.total = size
      }

      if (this.math.remainder(this.i, this.step) === 0) {
        updateProgress(
          this.i / this.total,
          `Processing candle on ${new Date(b.time).toUTCString()}`,
        )
      }
      this.i++
    }
    for (const s of this.strategies) {
      s.processBar(b, nextBar)
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
      s.processTrade(trade, candles)
    }
  }

  public override getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    const map: Map<ExchangeIntervals, number> = new Map()
    for (const s of this.strategies) {
      s.getOtherIntervals().forEach((i) =>
        map.set(i.interval, Math.max(map.get(i.interval) ?? 0, i.countBack)),
      )
    }
    return Array.from(map).map(([k, v]) => ({ interval: k, countBack: v }))
  }
}

export default CombinedStrategy
