import Backtesting from '..'

import {
  CloseConditionEnum,
  DCAConditionEnum,
  ExchangeIntervals,
  FullBar,
  StartConditionEnum,
  timeIntervalMap,
} from '../types'

import getStrategyBySettings, { StrategyInterface } from './strategy'

import CombinedStrategy from './strategy/combined'

import {
  DCABacktestingInput,
  DCABotSettings,
  EdgeBacktestEnum,
  TradeResponse,
} from '../types'

class DCABacktesting extends Backtesting {
  private strategy?: StrategyInterface

  private settings: DCABotSettings

  private edge?: EdgeBacktestEnum

  constructor({
    settings,
    userFee,
    symbols,
    prices,
    interval,
    balances,
    slippage,
    combo,
    trades,
    edge,
    previousData,
    multi,
    timezone,
    ...rest
  }: DCABacktestingInput) {
    const candleInterval = interval ?? ExchangeIntervals.fiveM
    super({
      ...rest,
      interval: candleInterval,
      symbols,
      userFee,
      prices,
      settings,
      trades,
      timezone,
    })
    this.edge = edge
    this.settings = settings
    const strategy = getStrategyBySettings(settings, edge)
    if (strategy) {
      this.strategy = new CombinedStrategy(
        {
          settings,
          symbols,
          userFee,
          prices,
          interval: candleInterval,
          balances,
          slippage,
          combo,
          trades,
          edge,
          previousData,
          multi,
          timezone,
        },
        ...strategy,
      )
    }
  }

  set _from(value: number) {
    this.from = value
  }

  set _to(value: number) {
    this.to = value
  }

  override set stop(value: boolean) {
    this._stop = value
    if (this.strategy) {
      this.strategy.stop = value
    }
  }

  public getOtherIntervals() {
    if (this.strategy) {
      return this.strategy.getOtherIntervals()
    }
  }

  public async test(
    bars?: { bar: FullBar[]; interval: ExchangeIntervals }[],
    updateProgress?: (value: number, text: string) => void,
    loadDataCallBack?: () => void,
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
      if (this.strategy) {
        this.strategy._start = this.period.from
      }
      return
    }
    let testData: {
      bar: FullBar[]
      interval: ExchangeIntervals
    }[] = []
    if (bars) {
      testData = bars
    } else {
      const isIndicators =
        (this.settings.startCondition === StartConditionEnum.ti ||
          (this.settings.dealCloseCondition === CloseConditionEnum.techInd &&
            this.settings.useTp) ||
          (this.settings.dealCloseConditionSL === CloseConditionEnum.techInd &&
            this.settings.useSl) ||
          (this.settings.dcaCondition === DCAConditionEnum.indicators &&
            this.settings.useDca)) &&
        this.edge !== EdgeBacktestEnum.random
      if (!isIndicators) {
        const data = await this._loadData()
        testData = [{ bar: data, interval: this.interval }]
      } else {
        let i = 1
        for (const oi of otherIntervals) {
          await this._loadData(
            oi.interval,
            undefined,
            {
              from:
                (this.period.from * 1000 -
                  oi.countBack * timeIntervalMap[oi.interval]) /
                1000,
              to: this.period.to,
              firstDataRequest: false,
              countBack: oi.countBack,
            },
            i,
            otherIntervals.length,
          ).then((res) => {
            testData.push({ bar: res, interval: oi.interval })
            i++
          })
        }
      }
    }
    if (loadDataCallBack) {
      loadDataCallBack()
    }
    const loadingTime = (new Date().getTime() - startLoading) / 1000
    const start = new Date().getTime()
    const startTime = /* bars
      ?  */ Math.max(
      testData[0]?.bar?.[0]?.time ?? this.period.from * 1000,
      this.period.from * 1000,
    )
    /*  : this.period.from * 1000 */
    this.strategy.loadData(testData, startTime)
    const lowest = testData.find((d) => d.interval === lowestInterval)
    return this.strategy
      .test(
        lowest?.bar[0]?.time ?? 0,
        lowest?.bar[(lowest.bar.length ?? 1) - 1]?.time ?? 0,
        updateProgress,
      )
      .then(() => {
        if (this._stop) {
          return
        }
        const processingTime = (new Date().getTime() - start) / 1000
        if (this.strategy && lowest) {
          const startBar: Map<string, FullBar> = new Map()
          const lastBar: Map<string, FullBar> = new Map()
          for (const s of this.symbols.keys()) {
            const barsBySymbol = lowest.bar.filter(
              (b) => b.time > startTime && b.symbol === s,
            )
            if (barsBySymbol.length) {
              startBar.set(s, barsBySymbol[0])
              lastBar.set(s, barsBySymbol[barsBySymbol.length - 1])
            }
          }
          const result = this.strategy.returnResult(
            startBar,
            lastBar,
            loadingTime,
            processingTime,
          )
          if (result.noData) {
            result.duration.firstDataTime = this.period.from * 1000
            result.duration.lastDataTime = this.period.to * 1000
          }
          return result
        }
      })
  }

  public returnResult(
    firstData: Map<string, FullBar>,
    lastData: Map<string, FullBar>,
  ) {
    if (this.strategy) {
      return this.strategy.returnResult(firstData, lastData, 0, 0)
    }
  }

  public passTradeCandleData(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
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
