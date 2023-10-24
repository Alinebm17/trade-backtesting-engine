import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

import type { TradeResponse } from '../../types'

class TimerStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    const firstTime = Strategy.data[0].bar[0].time
    Strategy.next = new Date(
      `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
    ).getTime()
    if (Strategy.next < firstTime) {
      const tempDate = new Date(Strategy.next)
      tempDate.setDate(tempDate.getDate() + 1)
      Strategy.next = tempDate.getTime()
    }
    for (const b of Strategy.data[0].bar) {
      await this.processBar(b)
    }
  }

  public processTrade(trade: TradeResponse): void {
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(trade.timestamp)
      const firstTime = trade.timestamp
      Strategy.next = new Date(
        `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
      ).getTime()
      if (Strategy.next < firstTime) {
        const tempDate = new Date(Strategy.next)
        tempDate.setDate(tempDate.getDate() + 1)
        Strategy.next = tempDate.getTime()
      }
    }
    if (trade.timestamp === Strategy.next) {
      this.openDeal(+trade.price, trade.timestamp, +trade.price, +trade.price)
      const date = new Date(Strategy.next)
      date.setDate(date.getDate() + +this.settings.hodlDay)
      Strategy.next = date.getTime()
    }
    this.checkDeals({
      open: +trade.price,
      high: +trade.price,
      low: +trade.price,
      close: +trade.price,
      time: trade.timestamp,
    })
  }

  public async processBar(bar: Bar): Promise<void> {
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(bar.time)
      const firstTime = Strategy.data[0].bar[0].time
      Strategy.next = new Date(
        `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
      ).getTime()
      if (Strategy.next < firstTime) {
        const tempDate = new Date(Strategy.next)
        tempDate.setDate(tempDate.getDate() + 1)
        Strategy.next = tempDate.getTime()
      }
    }
    if (bar.time === Strategy.next) {
      this.openDeal(bar.close, bar.time, bar.high, bar.low)
      const date = new Date(Strategy.next)
      if (this.settings.hodlHourly) {
        date.setHours(date.getHours() + +this.settings.hodlDay)
      } else {
        date.setDate(date.getDate() + +this.settings.hodlDay)
      }
      Strategy.next = date.getTime()
    }
    await this.checkDeals(bar)
  }
}

export default TimerStrategy
