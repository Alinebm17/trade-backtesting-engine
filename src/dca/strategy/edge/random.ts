import { Strategy, StrategyInterface } from '../main'

import type { StrategyInput } from '../main'

import {
  CloseConditionEnum,
  CooldownUnits,
  TradeResponse,
  timeIntervalMap,
  FullBar,
} from '../../../types'

class EdgeRandomStrategy extends Strategy implements StrategyInterface {
  private startTimes: number[] = []

  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    for (const b of Strategy.data[0].bar) {
      await this.processBar(false, b)
    }
  }

  public async preTest(): Promise<void> {
    const data = Strategy.data.find((d) => d.interval === Strategy.interval)
    const interval = 100
    if (data && Strategy.previousResult) {
      const step = Math.min(Math.max(1, data.bar.length / 2), interval)
      const timeToClose = Math.floor(
        (timeIntervalMap[Strategy.interval] * step) / 1000,
      )
      do {
        const index = Math.floor(
          Math.random() * Math.max(1, data.bar.length - interval),
        )
        const bar = data.bar[index]
        if (!this.startTimes.includes(bar.time)) {
          this.startTimes.push(bar.time)
        }
      } while (
        this.startTimes.length <
        Math.min(Math.max(1, (data.bar.length - interval) / 2), 300)
      )
      this.settings = {
        ...this.settings,
        closeByTimer: true,
        closeByTimerUnits: CooldownUnits.seconds,
        closeByTimerValue: timeToClose,
        useDca: false,
        useSl: false,
        useTp: true,
        dealCloseCondition: CloseConditionEnum.webhook,
        maxNumberOfOpenDeals: '-1',
        baseOrderSize: `${Strategy.previousResult.usage.avgRealUsage}`,
      }
    }
  }

  public processTrade(_trade: TradeResponse): void {
    void 0
  }

  public async processBar(
    _checkPortfolio: boolean,
    bar: FullBar,
  ): Promise<void> {
    Strategy.lastPrice.set(bar.symbol, bar.close)
    if (Strategy.getDeals()) {
      if (
        Strategy.workingShift.length === 0 &&
        ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start)
      ) {
        this.startWorkingShift(bar.time)
      }
    }
    if (this.startTimes.includes(bar.time)) {
      this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
    }
    await this.checkDeals(false, bar)
  }
}

export default EdgeRandomStrategy
