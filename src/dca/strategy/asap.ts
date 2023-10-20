import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

import { TradeResponse } from '../../types'

class ASAPStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    for (const b of Strategy.data[0].bar) {
      await this.processBar(b)
    }
  }

  public processTrade(trade: TradeResponse): void {
    if (Strategy.deals.length === 0) {
      if (Strategy.workingShift.length === 0) {
        this.startWorkingShift(trade.timestamp)
      }
      this.openDeal(+trade.price, trade.timestamp, +trade.price, +trade.price)
    } else if (
      Strategy.deals.length !== 0 &&
      Strategy.deals.filter((d) => d.status === 'closed').length ===
        Strategy.deals.length
    ) {
      this.openDeal(+trade.price, trade.timestamp, +trade.price, +trade.price)
    } else {
      this.checkDeals(
        {
          open: +trade.price,
          high: +trade.price,
          low: +trade.price,
          close: +trade.price,
          time: trade.timestamp,
        },
        (price: number) =>
          this.openDeal(price, trade.timestamp, +trade.price, +trade.price),
      )
    }
  }

  public async processBar(bar: Bar): Promise<void> {
    if (Strategy.deals.length === 0) {
      if (Strategy.workingShift.length === 0) {
        this.startWorkingShift(bar.time)
      }
      this.openDeal(bar.close, bar.time, bar.high, bar.low)
    } else if (
      Strategy.deals.length !== 0 &&
      Strategy.deals.filter((d) => d.status === 'closed').length ===
        Strategy.deals.length
    ) {
      this.openDeal(bar.close, bar.time, bar.high, bar.low)
    } else {
      await this.checkDeals(bar, (price: number) =>
        this.openDeal(price, bar.time, bar.high, bar.low),
      )
    }
  }
}

export default ASAPStrategy
