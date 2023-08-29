import Backtesting from '..'

import { Bar, ExchangeIntervals } from '../types'

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
    trades,
    ...rest
  }: GRIDBacktestingInput) {
    const candleInterval = interval ?? ExchangeIntervals.fiveM
    super({
      ...rest,
      interval: candleInterval,
      symbol,
      userFee,
      prices,
      settings,
      trades,
    })
    this.strategy = new Strategy({
      settings,
      symbol,
      userFee,
      prices,
      interval,
      trades,
    })
  }

  public async test(_data?: Bar[]) {
    if (!this.strategy) {
      return
    }

    const startLoading = new Date().getTime()
    const data = _data || (await this._loadData())
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
