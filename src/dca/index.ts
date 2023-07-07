import Backtesting from '..'

import { Bar, ExchangeIntervals, timeIntervalMap } from '../types'

import getStrategyBySettings, { StrategyInterface } from './strategy'

import CombinedStrategy from './strategy/combined'

import type { DCABacktestingInput } from '../types'

class DCABacktesting extends Backtesting {
  private strategy?: StrategyInterface

  constructor({
    settings,
    userFee,
    symbol,
    prices,
    interval,
    balances,
    slippage,
    combo,
    ...rest
  }: DCABacktestingInput) {
    const candleInterval = interval ?? ExchangeIntervals.fiveM
    super({
      ...rest,
      interval: candleInterval,
      symbol,
      userFee,
      prices,
      settings,
    })
    const strategy = getStrategyBySettings(settings)
    if (strategy) {
      this.strategy = new CombinedStrategy(
        {
          settings,
          symbol,
          userFee,
          prices,
          interval: candleInterval,
          balances,
          slippage,
          combo,
        },
        ...strategy,
      )
    }
  }

  public async test(bars?: { bar: Bar[]; interval: ExchangeIntervals }[]) {
    if (!this.strategy) {
      return
    }
    const startLoading = new Date().getTime()
    const intervals = this.strategy.getOtherIntervals()
    intervals.push(this.interval)
    const [lowestInterval] = intervals.sort(
      (a, b) => timeIntervalMap[a] - timeIntervalMap[b],
    )
    this.interval = lowestInterval
    this.period = this.calculatePeriod(lowestInterval)
    let testData: { bar: Bar[]; interval: ExchangeIntervals }[] = []
    if (bars) {
      testData = bars
    } else {
      const data = await this._loadData()
      testData = [{ bar: data, interval: this.interval }]
      const otherIntervals = intervals.filter((i) => i !== this.interval)
      const queries: Promise<void>[] = []
      otherIntervals.forEach((oi) =>
        queries.push(
          this._loadData(oi, this.period.from).then((res) => {
            testData.push({ bar: res, interval: oi })
          }),
        ),
      )
      await Promise.all(queries)
    }
    const loadingTime = (new Date().getTime() - startLoading) / 1000
    const start = new Date().getTime()
    this.strategy.loadData(testData)
    this.strategy.test()
    const processingTime = (new Date().getTime() - start) / 1000
    const [lowest] = testData.filter((d) => d.interval === lowestInterval)
    return this.strategy.returnResult(
      lowest.bar[0],
      lowest.bar[lowest.bar.length - 1],
      loadingTime,
      processingTime,
    )
  }

  public getTestingPeriod() {
    if (!this.strategy) {
      return
    }
    const intervals = this.strategy.getOtherIntervals()

    intervals.push(this.interval)
    const [lowestInterval] = intervals.sort(
      (a, b) => timeIntervalMap[a] - timeIntervalMap[b],
    )
    return this.calculatePeriod(lowestInterval)
  }
}

export default DCABacktesting
