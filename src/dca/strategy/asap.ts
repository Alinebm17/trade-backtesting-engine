import { Strategy, StrategyInterface } from './main'

import type { StrategyInput } from './main'

import { TradeResponse, FullBar, DCABotSettings } from '../../types'

class ASAPStrategy extends Strategy implements StrategyInterface {
  public settings: DCABotSettings

  constructor(input: StrategyInput) {
    super(input)
    this.settings = input.settings
    this.processBar = this.processBar.bind(this)
  }

  public async test(): Promise<void> {
    for (const b of Strategy.data[0].bar) {
      await this.processBar(false, b)
    }
  }

  public async preTest(): Promise<void> {
    void 0
  }

  public processTrade(trade: TradeResponse): void {
    const allDeals = Strategy.getDeals()
    if (allDeals.length === 0) {
      if (
        Strategy.workingShift.length === 0 &&
        ((Strategy.start && trade.timestamp >= Strategy.start) ||
          !Strategy.start)
      ) {
        this.startWorkingShift(trade.timestamp)
      }
      this.openDeal(
        +trade.price,
        trade.timestamp,
        +trade.price,
        +trade.price,
        trade.symbol,
      )
    } else if (
      allDeals.length !== 0 &&
      Strategy.getDeals('closed').length === allDeals.length
    ) {
      this.openDeal(
        +trade.price,
        trade.timestamp,
        +trade.price,
        +trade.price,
        trade.symbol,
      )
    } else {
      this.checkDeals(
        false,
        {
          open: +trade.price,
          high: +trade.price,
          low: +trade.price,
          close: +trade.price,
          time: trade.timestamp,
          symbol: trade.symbol,
        },
        (price: number) =>
          this.openDeal(
            price,
            trade.timestamp,
            +trade.price,
            +trade.price,
            trade.symbol,
          ),
      )
    }
  }

  public async processBar(
    checkPortfolio: boolean,
    bar: FullBar,
  ): Promise<void> {
    const maxPerSymbol =
      this.settings.useMulti &&
      Strategy.multi &&
      this.settings.maxDealsPerPair &&
      +this.settings.maxDealsPerPair !== 0 &&
      !isNaN(+this.settings.maxDealsPerPair)
        ? +this.settings.maxDealsPerPair
        : 1
    const dealsPerSymbols = Strategy.getDeals(undefined, bar.symbol)
    if (dealsPerSymbols.length === 0) {
      if ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start) {
        const newShift = Strategy.workingShift.length === 0
        if (newShift) {
          this.startWorkingShift(bar.time)
        }
        for (const _ of [...Array(maxPerSymbol).keys()]) {
          this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
        }
        if (newShift) {
          this.checkPortfolio(bar.time, bar.close, bar.symbol)
        }
      }
    } else if (
      dealsPerSymbols.length !== 0 &&
      (dealsPerSymbols.filter((d) => d.status === 'closed').length ===
        dealsPerSymbols.length ||
        dealsPerSymbols.filter((d) => d.status === 'open').length <
          maxPerSymbol)
    ) {
      for (const _ of [...Array(maxPerSymbol).keys()]) {
        this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
      }
    } else {
      await this.checkDeals(checkPortfolio, bar, (price: number) =>
        this.openDeal(price, bar.time, bar.high, bar.low, bar.symbol),
      )
    }
  }
}

export default ASAPStrategy
