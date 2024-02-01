import { Strategy, StrategyInterface } from './main'

import type { StrategyInput } from './main'

import type { DCABotSettings, FullBar, TradeResponse } from '../../types'

class TimerStrategy extends Strategy implements StrategyInterface {
  public settings: DCABotSettings

  private timezone?: string

  constructor(input: StrategyInput) {
    super(input)
    this.settings = input.settings
    this.processBar = this.processBar.bind(this)
    this.timezone =
      input.timezone ??
      (Intl ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined)
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
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && trade.timestamp >= Strategy.start) || !Strategy.start)
    ) {
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

  private getTimezoneOffset(timeZone: string | undefined, date = new Date()) {
    const tz = date
      .toLocaleString('en', { timeZone, timeStyle: 'long' })
      .split(' ')
      .slice(-1)[0]
    const dateString = date.toString()
    const currentTz = new Date()
      .toLocaleString('en', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeStyle: 'long',
      })
      .split(' ')
      .slice(-1)[0]
    const offset =
      Date.parse(`${dateString} ${currentTz}`) -
      Date.parse(`${dateString} ${tz}`)
    console.log(offset, currentTz, tz, dateString)
    return offset
  }

  public async processBar(bar: FullBar): Promise<void> {
    let next = Strategy.next.get(bar.symbol)
    if (!next) {
      next = 0
    }
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start)
    ) {
      this.startWorkingShift(bar.time)
    }
    if (next === 0) {
      const firstTime = bar.time
      const time = new Date(
        `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
      ).getTime()
      next = this.timezone ? time - this.getTimezoneOffset(this.timezone) : time
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
        this.openDeal(bar.open, bar.time, bar.high, bar.low, bar.symbol)
      }
      next = date.getTime()
    }
    Strategy.next.set(bar.symbol, next)
    await this.checkDeals(bar)
  }
}

export default TimerStrategy
