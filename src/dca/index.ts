import Backtesting from '..'
import { v4 } from 'uuid'

import {
  BotStartTypeEnum,
  CloseConditionEnum,
  DCAConditionEnum,
  ExchangeIntervals,
  FullBar,
  IndicatorEnum,
  PairPrioritizationEnum,
  ScaleDcaTypeEnum,
  StartConditionEnum,
  timeIntervalMap,
} from '../types'

import getStrategyBySettings, { StrategyInterface } from './strategy'
import { Strategy } from './strategy/main'

import CombinedStrategy from './strategy/combined'

import {
  DCABacktestingInput,
  DCABotSettings,
  EdgeBacktestEnum,
  TradeResponse,
  DirName,
} from '../types'

class DCABacktesting extends Backtesting {
  public strategy?: StrategyInterface

  // Track latest bars for unrealized PnL calculation
  private latestBars: Map<string, FullBar> = new Map()

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
    useFile,
    fullResult,
    ...rest
  }: DCABacktestingInput) {
    const candleInterval = interval ?? ExchangeIntervals.fiveM
    super(
      {
        ...rest,
        interval: candleInterval,
        symbols,
        userFee,
        prices,
        settings,
        trades,
        timezone,
        useFile,
        fullResult,
      },
      v4(),
    )
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
          useFile,
          fullResult,
          exchange: this.exchange,
        },
        this.fileName,
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
          ((this.settings.dealCloseCondition === CloseConditionEnum.techInd ||
            this.settings.dealCloseCondition ===
              CloseConditionEnum.dynamicAr) &&
            this.settings.useTp) ||
          this.settings.useRiskReward ||
          ((this.settings.dealCloseConditionSL === CloseConditionEnum.techInd ||
            this.settings.dealCloseConditionSL ===
              CloseConditionEnum.dynamicAr) &&
            this.settings.useSl) ||
          (this.settings.dcaCondition === DCAConditionEnum.indicators &&
            this.settings.useDca) ||
          (this.settings.useBotController &&
            (this.settings.botStart === BotStartTypeEnum.indicators ||
              this.settings.botActualStart === BotStartTypeEnum.indicators)) ||
          (this.settings.useDca &&
            [ScaleDcaTypeEnum.adr, ScaleDcaTypeEnum.atr].includes(
              this.settings.scaleDcaType ?? ScaleDcaTypeEnum.percentage,
            ))) &&
        this.edge !== EdgeBacktestEnum.random &&
        this.settings.indicators.filter((i) => i.type !== IndicatorEnum.unpnl)
          .length > 0
      if (!isIndicators) {
        const data = await this._loadData(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          this.settings.pairPrioritization === PairPrioritizationEnum.random,
        )
        testData = [{ bar: data, interval: this.interval }]
      } else {
        let i = 0
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
            this.settings.pairPrioritization === PairPrioritizationEnum.random,
          ).then((res) => {
            testData.push({ bar: res, interval: oi.interval })
            i++
          })
        }
      }
    }
    const start = new Date().getTime()
    if (loadDataCallBack) {
      loadDataCallBack()
    }
    await this.sortData(
      updateProgress,
      this.settings.pairPrioritization === PairPrioritizationEnum.random,
    )
    const loadingTime = (new Date().getTime() - startLoading) / 1000

    const startTime = /* bars
      ?  */ Math.max(
      testData[0]?.bar?.[0]?.time ?? this.period.from * 1000,
      this.period.from * 1000,
    )
    /*  : this.period.from * 1000 */
    this.strategy.loadData(testData, startTime)

    const lowest = testData.find((d) => d.interval === lowestInterval)
    let firstTime = lowest?.bar[0]?.time ?? 0
    let lastTime = lowest?.bar[(lowest.bar.length ?? 1) - 1]?.time ?? 0
    let startBar: Map<string, FullBar> = new Map()
    let lastBar: Map<string, FullBar> = new Map()
    let total = 0
    if (lowest) {
      total = lowest.bar.length
      for (const s of this.symbols.keys()) {
        const barsBySymbol = lowest.bar.filter(
          (b) => b.time > startTime && b.symbol === s,
        )
        if (barsBySymbol.length) {
          startBar.set(s, barsBySymbol[0])
          lastBar.set(s, barsBySymbol[barsBySymbol.length - 1])
        }
      }
    }

    if (this.useFile) {
      const fs = require('fs')
      const path = require('path')
      const dir = path.join(__dirname, `../${DirName}`)
      const file = `${dir}/${this.fileName}.csv`
      const csv = require('csv-parser')
      if (fs.existsSync(dir) && fs.existsSync(file)) {
        const _startBar: Map<string, FullBar> = new Map()
        const _lastBar: Map<string, FullBar> = new Map()

        await new Promise((res) =>
          fs
            .createReadStream(file, 'utf-8')
            .pipe(csv({ separator: ';' }))
            .on(
              'data',
              async (raw: {
                o: string
                h: string
                l: string
                c: string
                v: string
                t: string
                s: string
                i: string
              }) => {
                if (this._stop) {
                  return
                }
                if (raw.i !== lowestInterval) {
                  return
                }
                total++
                const bar = {
                  open: +raw.o,
                  high: +raw.h,
                  low: +raw.l,
                  close: +raw.c,
                  volume: +raw.v,
                  time: +raw.t,
                  symbol: raw.s,
                }
                if (bar.time >= startTime && firstTime === 0) {
                  firstTime = bar.time
                  if (!_startBar.has(bar.symbol)) {
                    _startBar.set(bar.symbol, bar)
                  }
                }

                _lastBar.set(bar.symbol, bar)
              },
            )
            .on('end', () => {
              res([])
            })
            .on('error', () => res([])),
        )
        const firstValue = _lastBar.values().next().value
        if (firstValue) {
          lastTime = firstValue.time
        }
        startBar = _startBar
        lastBar = _lastBar
      }
    }
    return this.strategy
      .test(firstTime, lastTime, updateProgress, total)
      .then(() => {
        if (this.useFile) {
          const fs = require('fs')
          const path = require('path')
          const dir = path.join(__dirname, `../${DirName}`)
          const file = `${dir}/${this.fileName}.csv`
          if (fs.existsSync(dir) && fs.existsSync(file)) {
            fs.unlinkSync(file)
          }
        }
        if (this._stop) {
          return
        }
        const processingTime = (new Date().getTime() - start) / 1000
        if (this.strategy && lowest) {
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

  // Method to check if the strategy supports controlled bar processing
  public supportsControlledProcessing(): boolean {
    return this.strategy
      ? typeof this.strategy.processBar === 'function'
      : false
  }

  // Method to process a single bar in controlled mode
  public async processBar(
    bar: FullBar,
    interval?: ExchangeIntervals,
    checkPortfolio: boolean = false,
  ): Promise<void> {
    // Store latest bar for unrealized PnL calculation
    // Use just symbol since FullBar doesn't have exchange property
    this.latestBars.set(bar.symbol, bar)

    if (this.strategy && this.strategy.processBar) {
      await this.strategy.processBar(checkPortfolio, bar, interval)
    }
  }

  // Method to get current unrealized PnL
  public getCurrentUnrealizedPnL(): {
    totalUnrealizedPnL: number
    totalUnrealizedPnLUsd: number
    dealCount: number
  } {
    if (!this.strategy) {
      return { totalUnrealizedPnL: 0, totalUnrealizedPnLUsd: 0, dealCount: 0 }
    }

    // Access the strategy's static methods to get open deals
    const strategyClass = this.strategy.constructor as typeof Strategy
    const openDeals = strategyClass.getDeals('open')

    if (openDeals.length === 0) {
      return { totalUnrealizedPnL: 0, totalUnrealizedPnLUsd: 0, dealCount: 0 }
    }

    let totalUnrealizedPnL = 0
    let totalUnrealizedPnLUsd = 0

    for (const deal of openDeals) {
      // Get current price from latest bar data for this symbol
      // Use deal.symbol.pair since that's the trading pair identifier
      const currentBar = this.latestBars.get(deal.symbol.pair)

      if (currentBar && deal.avgPrice > 0) {
        // Calculate unrealized PnL: (currentPrice - avgPrice) / avgPrice * position size
        const priceChange = (currentBar.close - deal.avgPrice) / deal.avgPrice
        const unrealizedPnL = priceChange * deal.usage.current.base
        const unrealizedPnLUsd = priceChange * deal.usage.current.quote

        totalUnrealizedPnL += unrealizedPnL
        totalUnrealizedPnLUsd += unrealizedPnLUsd
      }
    }

    return {
      totalUnrealizedPnL,
      totalUnrealizedPnLUsd,
      dealCount: openDeals.length,
    }
  }

  // Method to initialize strategy for controlled processing
  public async initializeForControlledProcessing(
    bars: { bar: FullBar[]; interval: ExchangeIntervals }[],
  ): Promise<boolean> {
    if (!this.strategy) {
      return false
    }

    // Set up the strategy with initial data similar to the test method
    const otherIntervals = this.strategy.getOtherIntervals()
    const intervals = otherIntervals.map((oi) => oi.interval)
    intervals.push(this.interval)
    const [lowestInterval] = intervals.sort(
      (a, b) => timeIntervalMap[a] - timeIntervalMap[b],
    )
    this.interval = lowestInterval
    this.period = this.calculatePeriod(lowestInterval)

    const startTime = Math.max(
      bars[0]?.bar?.[0]?.time ?? this.period.from * 1000,
      this.period.from * 1000,
    )

    this.strategy.loadData(bars, startTime)

    // Initialize the strategy
    await this.strategy.preTest()

    return true
  }

  // Getters for hedge access
  public getSymbols() {
    return this.symbols
  }

  public getExchange() {
    return this.exchange
  }
}

export default DCABacktesting
