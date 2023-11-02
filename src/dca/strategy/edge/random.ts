import { Strategy, StrategyInterface } from '../main'

import type { StrategyInput, Bar } from '../main'

import {
  CloseConditionEnum,
  CooldownUnits,
  TradeResponse,
  timeIntervalMap,
} from '../../../types'

class EdgeRandomStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    for (const b of Strategy.data[0].bar) {
      await this.processBar(b)
    }
  }

  public async preTest(): Promise<void> {
    const data = Strategy.data.find((d) => d.interval === Strategy.interval)
    if (data && Strategy.previousResult) {
      const step = Math.min(Math.max(1, data.bar.length / 2), 100)
      const timeToClose = Math.floor(
        (timeIntervalMap[Strategy.interval] * step) / 1000,
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
        maxNumberOfOpenDeals: '4',
        baseOrderSize: `${Strategy.previousResult.usage.avgRealUsage}`,
        closeAfterX: `${Math.max(Strategy.previousResult.deals.length, 300)}`,
        useCloseAfterX: true,
      }
    }
  }

  public processTrade(_trade: TradeResponse): void {
    void 0
  }

  public async processBar(bar: Bar): Promise<void> {
    if (Strategy.deals.length === 0) {
      if (Strategy.workingShift.length === 0) {
        this.startWorkingShift(bar.time)
      }
    }
    if (Math.random() > 0.3) {
      this.openDeal(bar.close, bar.time, bar.high, bar.low)
    }
    await this.checkDeals(bar)
  }
}

export default EdgeRandomStrategy
