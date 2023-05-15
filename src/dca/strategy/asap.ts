import { Strategy, StrategyInterface } from './main'

import type { StrategyInput, Bar } from './main'

class ASAPStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
  }

  public test(): void {
    Strategy.data[0].bar.forEach((b) => this.processBar(b))
  }

  public processBar(bar: Bar): void {
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
      this.checkDeals(bar, (price: number) =>
        this.openDeal(price, bar.time, bar.high, bar.low),
      )
    }
  }
}

export default ASAPStrategy
