import Backtesting from '..'

import {
  Bar,
  CloseConditionEnum,
  DCAConditionEnum,
  ExchangeIntervals,
  StartConditionEnum,
  timeIntervalMap,
} from '../types'

import getStrategyBySettings, { StrategyInterface } from './strategy'

import CombinedStrategy from './strategy/combined'

import type {
  DCABacktestingInput,
  DCABotSettings,
  TradeResponse,
} from '../types'

class DCABacktesting extends Backtesting {
  private strategy?: StrategyInterface

  private settings: DCABotSettings

  constructor({
    settings,
    userFee,
    symbol,
    prices,
    interval,
    balances,
    slippage,
    combo,
    trades,
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
      trades,
    })
    this.settings = settings
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
          trades,
        },
        ...strategy,
      )
    }
  }

  override set stop(value: boolean) {
    this._stop = value
    if (this.strategy) {
      this.strategy.stop = value
    }
  }

  public async test(
    bars?: { bar: Bar[]; interval: ExchangeIntervals }[],
    updateProgress?: (value: number, text: string) => void,
  ) {
    if (!this.strategy) {
      return
    }
    const startLoading = new Date().getTime()
    const otherIntervals = this.strategy.getOtherIntervals()
    const intervals = otherIntervals.map((oi) => oi.interval)
    intervals.push(this.interval)
    const [lowestInterval] = intervals.sort(
      (a, b) => timeIntervalMap[a] - timeIntervalMap[b],
    )
    this.interval = lowestInterval
    this.period = this.calculatePeriod(lowestInterval)
    if (this.trades) {
      return
    }
    let testData: { bar: Bar[]; interval: ExchangeIntervals }[] = []
    if (bars) {
      testData = bars
    } else {
      const isIndicators =
        this.settings.startCondition === StartConditionEnum.ti ||
        (this.settings.dealCloseCondition === CloseConditionEnum.techInd &&
          this.settings.useTp) ||
        (this.settings.dealCloseConditionSL === CloseConditionEnum.techInd &&
          this.settings.useSl) ||
        (this.settings.dcaCondition === DCAConditionEnum.indicators &&
          this.settings.useDca)
      if (!isIndicators) {
        const data = await this._loadData()
        testData = [{ bar: data, interval: this.interval }]
      } else {
        const queries: Promise<void>[] = []
        for (const oi of otherIntervals) {
          queries.push(
            this._loadData(oi.interval, undefined, {
              from:
                (this.period.from * 1000 -
                  oi.countBack * timeIntervalMap[oi.interval]) /
                1000,
              to: this.period.to,
              firstDataRequest: false,
              countBack: oi.countBack,
            }).then((res) => {
              testData.push({ bar: res, interval: oi.interval })
            }),
          )
        }
        await Promise.all(queries)
      }
    }
    const loadingTime = (new Date().getTime() - startLoading) / 1000
    const start = new Date().getTime()
    this.strategy.loadData(
      testData,
      bars ? testData[0]?.bar?.[0]?.time : this.period.from * 1000,
    )
    return this.strategy.test(updateProgress).then(() => {
      if (this._stop) {
        return
      }
      const processingTime = (new Date().getTime() - start) / 1000
      const [lowest] = testData.filter((d) => d.interval === lowestInterval)
      if (this.strategy) {
        const result = this.strategy.returnResult(
          lowest.bar[0],
          lowest.bar[lowest.bar.length - 1],
          loadingTime,
          processingTime,
        )
        if (result.noData) {
          result.duration.firstDataTime = this.period.from * 1000
          result.duration.lastDataTime = this.period.to * 1000
        }
        console.log(result)
        return result
      }
    })
  }

  public returnResult(firstData: Bar, lastData: Bar) {
    if (this.strategy) {
      return this.strategy.returnResult(firstData, lastData, 0, 0)
    }
  }

  public passTradeCandleData(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ) {
    if (this.strategy?.passTradeCandleData) {
      this.strategy.passTradeCandleData(trade, candles)
    }
  }

  public getTestingPeriod() {
    if (!this.strategy) {
      return
    }
    const otherIntervals = this.strategy.getOtherIntervals()
    const intervals = otherIntervals.map((oi) => oi.interval)

    intervals.push(this.interval)
    const [lowestInterval] = intervals.sort(
      (a, b) => timeIntervalMap[a] - timeIntervalMap[b],
    )
    return this.calculatePeriod(lowestInterval)
  }
}

export default DCABacktesting
