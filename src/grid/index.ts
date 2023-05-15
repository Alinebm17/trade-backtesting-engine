import Backtesting from '..'

import { ExchangeIntervals } from '../types'

import { Strategy, StrategyInterface } from './strategy'

import type { GRIDBacktestingInput } from '../types'

class DCABacktesting extends Backtesting {
  private strategy: StrategyInterface

  constructor({
    settings,
    userFee,
    symbol,
    prices,
    interval,
    ...rest
  }: GRIDBacktestingInput) {
    const candleInterval = interval ?? ExchangeIntervals.fiveM
    super({ ...rest, interval: candleInterval, symbol })
    this.strategy = new Strategy({
      settings,
      symbol,
      userFee,
      prices,
      interval,
    })
  }

  public async test() {
    if (!this.strategy) {
      return
    }

    const startLoading = new Date().getTime()
    const data = await this.loadData()
    const loadingTime = (new Date().getTime() - startLoading) / 1000
    const start = new Date().getTime()
    this.strategy.loadData(data)
    this.strategy.test()
    const processingTime = (new Date().getTime() - start) / 1000
    return this.strategy.returnResult(
      data[0],
      data[data.length - 1],
      loadingTime,
      processingTime,
    )
  }

  public getTestingPeriod() {
    return this.period
  }
}

export default DCABacktesting
