import Backtesting from '..'

import { Bar, ExchangeIntervals } from '../types'

import { Strategy, StrategyInterface } from './strategy'

import type { GRIDBacktestingInput, TradeResponse } from '../types'

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

  override set stop(value: boolean) {
    this._stop = value
    if (this.strategy) {
      this.strategy.stop = value
    }
  }

  public async test(
    _data?: Bar[],
    updateProgress?: (value: number, text: string) => void,
  ) {
    if (!this.strategy) {
      return
    }

    const startLoading = new Date().getTime()
    const data = _data || (await this._loadData())
    const loadingTime = (new Date().getTime() - startLoading) / 1000
    if (this.trades) {
      return
    }
    const start = new Date().getTime()
    this.strategy.loadData(data)
    if (this._stop) {
      return
    }
    return this.strategy.test(updateProgress).then(() => {
      if (this._stop) {
        return
      }
      const processingTime = (new Date().getTime() - start) / 1000
      const result = this.strategy.returnResult(
        data[0],
        data[data.length - 1],
        loadingTime,
        processingTime,
      )
      if (result.noDate) {
        result.duration.firstDataTime = this.period.from * 1000
        result.duration.lastDataTime = this.period.to * 1000
      }
      return result
    })
  }

  public passTradeCandleData(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ) {
    if (this.strategy?.passTradeCandleData) {
      this.strategy.passTradeCandleData(trade, candles)
    }
  }

  public returnResult(firstData: Bar, lastData: Bar) {
    if (this.strategy) {
      return this.strategy.returnResult(firstData, lastData, 0, 0)
    }
  }

  public getTestingPeriod() {
    return this.period
  }
}

export default DCABacktesting
