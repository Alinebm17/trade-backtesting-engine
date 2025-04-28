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
    const allDeals = Strategy.getDealsCount()
    const allDealsClosed = Strategy.getDealsCount('closed')
    if (allDeals === 0) {
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
    } else if (allDeals !== 0 && allDealsClosed === allDeals) {
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
    const multi = this.settings.useMulti && Strategy.multi
    const useDynamic = !!(
      this.settings.useDynamicPriceFilter &&
      this.settings.dynamicPriceFilterDeviation &&
      this.settings.dynamicPriceFilterPriceType
    )
    let maxDeals =
      this.settings.maxNumberOfOpenDeals &&
      this.settings.maxNumberOfOpenDeals !== '' &&
      !isNaN(+this.settings.maxNumberOfOpenDeals)
        ? +this.settings.maxNumberOfOpenDeals
        : 1
    if (maxDeals < 0) {
      maxDeals = Infinity
    }
    let maxPerSymbol =
      multi &&
      this.settings.maxDealsPerPair &&
      +this.settings.maxDealsPerPair !== 0 &&
      !isNaN(+this.settings.maxDealsPerPair)
        ? +this.settings.maxDealsPerPair
        : 1
    if (maxPerSymbol < 0) {
      maxPerSymbol = Infinity
    }
    const dealsPerSymbols = Strategy.getDealsCount(undefined, bar.symbol)
    const dealsPerSymbolsClosed = Strategy.getDealsCount('closed', bar.symbol)
    const dealsPerSymbolsOpen = Strategy.getDealsCount('open', bar.symbol)
    let newShift = false
    if (dealsPerSymbols === 0) {
      if ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start) {
        newShift = Strategy.workingShift.length === 0
        if (newShift) {
          this.startWorkingShift(bar.time)
        }
        for (const _ of [...Array(useDynamic ? 1 : maxPerSymbol).keys()]) {
          this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
        }
      }
    } else if (
      dealsPerSymbols !== 0 &&
      (dealsPerSymbolsClosed === dealsPerSymbols ||
        dealsPerSymbolsOpen <
          (multi ? maxPerSymbol : useDynamic && maxDeals ? maxDeals : 1))
    ) {
      for (const _ of [...Array(useDynamic ? 1 : maxPerSymbol).keys()]) {
        this.openDeal(bar.close, bar.time, bar.high, bar.low, bar.symbol)
      }
    }
    if (dealsPerSymbolsOpen || newShift) {
      await this.checkDeals(checkPortfolio, bar, (price: number) => {
        this.openDeal(price, bar.time, bar.high, bar.low, bar.symbol)
        if (Strategy.combo) {
          this.checkDeals(false, bar)
        }
      })
    }
    if (newShift) {
      this.checkPortfolio(bar.time, bar.close, bar.symbol)
    }
  }
}

export default ASAPStrategy
