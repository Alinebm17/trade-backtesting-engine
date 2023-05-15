import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

class TimerStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public test(): void {
    const firstTime = Strategy.data[0].bar[0].time
    Strategy.next = new Date(
      `${new Date(firstTime).toDateString()} ${this.settings.hodlAt}`,
    ).getTime()
    if (Strategy.next < firstTime) {
      const tempDate = new Date(Strategy.next)
      tempDate.setDate(tempDate.getDate() + 1)
      Strategy.next = tempDate.getTime()
    }
    Strategy.data[0].bar.forEach((b) => this.processBar(b))
  }

  public processBar(bar: Bar): void {
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
      date.setDate(date.getDate() + +this.settings.hodlDay)
      Strategy.next = date.getTime()
    }
    this.checkDeals(bar)
  }
}

export default TimerStrategy
