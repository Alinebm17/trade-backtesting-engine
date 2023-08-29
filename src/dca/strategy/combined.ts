import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

import type { ExchangeIntervals, TradeResponse } from '../../types'

import { timeIntervalMap } from '../../types'

class CombinedStrategy extends Strategy implements StrategyInterface {
  private strategies: StrategyInterface[] = []

  constructor(
    input: StrategyInput,
    ...strategies: ((args: StrategyInput) => StrategyInterface)[]
  ) {
    Strategy.resetData()
    super(input)
    this.strategies = strategies.map((s) => s(input))
  }

  public test(): void {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    lowest.bar.forEach((b, i) => this.processBar(b, lowest.bar[i + 1]))
  }

  public processBar(b: Bar, nextBar: Bar): void {
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

  public override getOtherIntervals(): ExchangeIntervals[] {
    const set: Set<ExchangeIntervals> = new Set()
    for (const s of this.strategies) {
      s.getOtherIntervals().forEach((i) => set.add(i))
    }
    return Array.from(set)
  }
}

export default CombinedStrategy
