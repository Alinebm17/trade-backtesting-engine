import { Strategy, StrategyInterface } from './main'

import type { StrategyInput } from './main'

import type { DCABotSettings, FullBar, TradeResponse } from '../../types'

class TimerStrategy extends Strategy implements StrategyInterface {
  public settings: DCABotSettings

  constructor(input: StrategyInput) {
    super(input)
    this.settings = input.settings
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    /* const firstTime = Strategy.data[0].bar[0].time
    Strategy.next = new Date(
      `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
    ).getTime()
    if (Strategy.next < firstTime) {
      const tempDate = new Date(Strategy.next)
      tempDate.setDate(tempDate.getDate() + 1)
      Strategy.next = tempDate.getTime()
    } */
    for (const b of Strategy.data[0].bar) {
      await this.processBar(b)
    }
  }

  public async preTest(): Promise<void> {
    void 0
  }

  public processTrade(trade: TradeResponse): void {
    let next = Strategy.next.get(trade.symbol)
    if (!next) {
      next = 0
    }
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(trade.timestamp)
    }
    if (next === 0) {
      const firstTime = trade.timestamp
      next = new Date(
        `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
      ).getTime()
      if (next < firstTime) {
        const tempDate = new Date(next)
        tempDate.setDate(tempDate.getDate() + 1)
        next = tempDate.getTime()
      }
    }
    if (trade.timestamp === next) {
      this.openDeal(
        +trade.price,
        trade.timestamp,
        +trade.price,
        +trade.price,
        trade.symbol,
      )
      const date = new Date(next)
      date.setDate(date.getDate() + +this.settings.hodlDay)
      next = date.getTime()
    }
    this.checkDeals({
      open: +trade.price,
      high: +trade.price,
      low: +trade.price,
      close: +trade.price,
      time: trade.timestamp,
      symbol: trade.symbol,
    })
    Strategy.next.set(trade.symbol, next)
  }

  public async processBar(bar: FullBar): Promise<void> {
    let next = Strategy.next.get(bar.symbol)
    if (!next) {
      next = 0
    }
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(bar.time)
    }
    if (next === 0) {
      const firstTime = bar.time
      next = new Date(
        `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
      ).getTime()
      if (next < firstTime) {
        const tempDate = new Date(next)
        tempDate.setDate(tempDate.getDate() + 1)
        next = tempDate.getTime()
      }
    }
    if (bar.time === next) {
      const date = new Date(next)
      if (this.settings.hodlHourly) {
        date.setHours(date.getHours() + +this.settings.hodlDay)
      } else {
        date.setDate(date.getDate() + +this.settings.hodlDay)
      }
      const maxPerSymbol =
        this.settings.useMulti &&
        Strategy.multi &&
        this.settings.maxDealsPerPair &&
        +this.settings.maxDealsPerPair !== 0 &&
        !isNaN(+this.settings.maxDealsPerPair)
          ? +this.settings.maxDealsPerPair
          : 1
      for (const _ of [...Array(maxPerSymbol).keys()]) {
        this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
      }
      next = date.getTime()
    }
    Strategy.next.set(bar.symbol, next)
    await this.checkDeals(bar)
  }
}

export default TimerStrategy
