import Backtesting from '..'
import DCABacktesting from '../dca'
import { v4 } from 'uuid'

import {
  ExchangeIntervals,
  FullBar,
  HedgeBotSettings,
  HedgeBacktestingInput,
  HedgeBacktestingResult,
  DCABacktestingResult,
  timeIntervalMap,
  StrategyEnum,
} from '../types'
import { StrategyContextManager } from 'src/dca/strategy/context'

type UniqueIntervalResponse = {
  interval: ExchangeIntervals
  symbol: string
  exchange: string
  from: number
  to: number
}

class HedgeBacktesting extends Backtesting {
  private longBacktester: DCABacktesting
  private shortBacktester: DCABacktesting
  private sharedSettings?: HedgeBotSettings

  constructor({
    longSettings,
    shortSettings,
    sharedSettings,
    ...commonInput
  }: HedgeBacktestingInput) {
    const candleInterval = commonInput.interval ?? ExchangeIntervals.fiveM
    super(
      {
        ...commonInput,
        interval: candleInterval,
        settings: longSettings,
      },
      v4(),
    )

    this.sharedSettings = sharedSettings

    this.longBacktester = new DCABacktesting({
      ...commonInput,
      settings: longSettings,
    })

    // Create short strategy backtest instance
    this.shortBacktester = new DCABacktesting({
      ...commonInput,
      settings: shortSettings,
    })
  }

  override set stop(value: boolean) {
    this._stop = value
    this.longBacktester.stop = value
    this.shortBacktester.stop = value
  }

  public getOtherIntervals() {
    // Get intervals from both strategies
    const longIntervals = this.longBacktester.getOtherIntervals() || []
    const shortIntervals = this.shortBacktester.getOtherIntervals() || []

    // Get symbols and exchanges from both strategies
    const longSymbols = this.longBacktester.getSymbols() || []
    const shortSymbols = this.shortBacktester.getSymbols() || []
    const longExchange = this.longBacktester.getExchange()
    const shortExchange = this.shortBacktester.getExchange()

    return {
      long: {
        intervals: [
          ...longIntervals,
          { interval: this.longBacktester.interval, countBack: 0 },
        ],
        symbols: longSymbols,
        exchange: longExchange,
      },
      short: {
        intervals: [
          ...shortIntervals,
          { interval: this.shortBacktester.interval, countBack: 0 },
        ],
        symbols: shortSymbols,
        exchange: shortExchange,
      },
    }
  }

  private getIntervalConfig() {
    const strategiesInfo = this.getOtherIntervals()

    // Get periods for calculating data requirements
    const longPeriod = this.longBacktester.getTestingPeriod()
    const shortPeriod = this.shortBacktester.getTestingPeriod()
    if (!longPeriod || !shortPeriod) {
      throw new Error('Cannot determine testing periods for strategies')
    }
    return {
      strategiesInfo,
      longPeriod,
      shortPeriod,
    }
  }

  // Method to get unique interval@symbol@exchange combinations
  private getUniqueIntervalSymbolExchange(
    config: ReturnType<typeof this.getIntervalConfig>,
  ): UniqueIntervalResponse[] {
    const combinations = new Map<string, UniqueIntervalResponse>()

    const { strategiesInfo, longPeriod, shortPeriod } = config

    // Process long strategy combinations
    for (const intervalInfo of strategiesInfo.long.intervals) {
      const interval = intervalInfo.interval
      const countBack = intervalInfo.countBack

      for (const symbol of strategiesInfo.long.symbols.keys()) {
        const key = `${interval}@${symbol}@${strategiesInfo.long.exchange}`
        const existing = combinations.get(key)

        const periodStart = longPeriod.from
        const periodEnd = longPeriod.to

        combinations.set(key, {
          interval,
          symbol,
          exchange: strategiesInfo.long.exchange,
          from: Math.min(
            existing?.from || Infinity,
            periodStart * 1000 - (countBack * timeIntervalMap[interval] || 0),
          ),
          to: Math.max(existing?.to || 0, periodEnd * 1000),
        })
      }
    }

    // Process short strategy combinations
    for (const intervalInfo of strategiesInfo.short.intervals) {
      const interval = intervalInfo.interval
      const countBack = intervalInfo.countBack

      for (const symbol of strategiesInfo.short.symbols.keys()) {
        const key = `${interval}@${symbol}@${strategiesInfo.short.exchange}`
        const existing = combinations.get(key)

        const periodStart = shortPeriod.from
        const periodEnd = longPeriod.to

        combinations.set(key, {
          interval,
          symbol,
          exchange: strategiesInfo.long.exchange,
          from: Math.min(
            existing?.from || Infinity,
            periodStart * 1000 - (countBack * timeIntervalMap[interval] || 0),
          ),
          to: Math.max(existing?.to || 0, periodEnd * 1000),
        })
      }
    }

    return Array.from(combinations.values())
  }

  private setContext(id: string) {
    StrategyContextManager.setActiveContext(id)
  }

  private setLongContext() {
    this.setContext('long')
  }

  private setShortContext() {
    this.setContext('short')
  }

  public async test(
    bars?: {
      long: { bar: FullBar[]; interval: ExchangeIntervals }[]
      short: { bar: FullBar[]; interval: ExchangeIntervals }[]
    },
    _updateProgress?: (value: number, text: string) => void,
    loadDataCallBack?: () => void,
  ): Promise<HedgeBacktestingResult | undefined> {
    if (this._stop) {
      return
    }
    //const startLoading = new Date().getTime()
    const config = this.getIntervalConfig()

    const { strategiesInfo, longPeriod, shortPeriod } = config
    let longBars: { bar: FullBar[]; interval: ExchangeIntervals }[] = []
    let shortBars: { bar: FullBar[]; interval: ExchangeIntervals }[] = []

    if (!bars) {
      const uniqueCombinations = this.getUniqueIntervalSymbolExchange(config)

      const allDataMap = new Map<
        string,
        {
          bar: FullBar[]
          interval: ExchangeIntervals
          from: number
          to: number
        }
      >()

      let loadedCount = 0
      for (const combination of uniqueCombinations) {
        const key = `${combination.interval}@${combination.symbol}@${combination.exchange}`

        // Skip if already loaded this combination
        if (!allDataMap.has(key)) {
          // Load data from the earliest required time to latest
          const data = await this._loadData(combination.interval, undefined, {
            from: combination.from,
            to: combination.to,
            firstDataRequest: true,
            countBack: 0,
          })

          allDataMap.set(key, {
            bar: data,
            interval: combination.interval,
            from: combination.from,
            to: combination.to,
          })
        }
        loadedCount++
      }

      // Step 4: Split bars into long and short arrays based on strategies

      // Process long strategy data
      for (const intervalInfo of strategiesInfo.long.intervals) {
        const interval = intervalInfo.interval

        // Get all bars for this interval and all symbols
        const intervalBars: FullBar[] = []
        for (const symbol of strategiesInfo.long.symbols.keys()) {
          const key = `${interval}@${symbol}@${strategiesInfo.long.exchange}`
          const data = allDataMap.get(key)
          if (data) {
            if (longPeriod) {
              if (longPeriod.from > data.from || longPeriod.to < data.to) {
                const filteredBars = data.bar.filter(
                  (bar) =>
                    bar.time >= longPeriod.from && bar.time <= longPeriod.to,
                )
                intervalBars.push(...filteredBars)
              } else {
                intervalBars.push(...data.bar)
              }
            }
          }
        }

        if (intervalBars.length > 0) {
          longBars.push({ bar: intervalBars, interval })
        }
      }

      // Process short strategy data
      for (const intervalInfo of strategiesInfo.short.intervals) {
        const interval = intervalInfo.interval

        // Get all bars for this interval and all symbols
        const intervalBars: FullBar[] = []
        for (const symbol of strategiesInfo.short.symbols.keys()) {
          const key = `${interval}@${symbol}@${strategiesInfo.short.exchange}`
          const data = allDataMap.get(key)
          if (data) {
            if (shortPeriod) {
              if (shortPeriod.from > data.from || shortPeriod.to < data.to) {
                const filteredBars = data.bar.filter(
                  (bar) =>
                    bar.time >= shortPeriod.from && bar.time <= shortPeriod.to,
                )
                intervalBars.push(...filteredBars)
              } else {
                intervalBars.push(...data.bar)
              }
            }
          }
        }

        if (intervalBars.length > 0) {
          shortBars.push({ bar: intervalBars, interval })
        }
      }
    } else {
      longBars = bars.long
      shortBars = bars.short
    }
    //const start = new Date().getTime()

    loadDataCallBack?.()

    //const loadingTime = (new Date().getTime() - startLoading) / 1000
    if (!this.longBacktester.strategy || !this.shortBacktester.strategy) {
      throw new Error(
        'Both long and short strategies must be initialized before testing',
      )
    }
    const longStartTime = Math.max(
      longBars[0]?.bar?.[0]?.time ?? longPeriod.from * 1000,
      longPeriod.from * 1000,
    )
    const shortStartTime = Math.max(
      shortBars[0]?.bar?.[0]?.time ?? shortPeriod.from * 1000,
      shortPeriod.from * 1000,
    )
    this.setLongContext()
    this.longBacktester.strategy.loadData(longBars, longStartTime)
    this.setShortContext()
    this.shortBacktester.strategy.loadData(shortBars, shortStartTime)
    //TODO: 1. create long/short lowest interval bars array
    // 2. feed bars one by one to both strategies
    // 3. check unrealized P&L after each bar
    // 4. combine results
    if (
      this.sharedSettings &&
      (this.sharedSettings.useSl || this.sharedSettings.useTp)
    ) {
      //create long/short lowest interval bars array
      const combinedMap: Map<number, (FullBar & { strategy: StrategyEnum })[]> =
        new Map()

      const longLowest = longBars.sort(
        (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
      )[0].bar
      const shortLowest = shortBars.sort(
        (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
      )[0].bar

      const lowSize = longLowest.length / strategiesInfo.long.symbols.size
      const shortSize = shortLowest.length / strategiesInfo.short.symbols.size
      const longTimeSet = new Set<number>()
      const shortTimeSet = new Set<number>()
      for (let i = 0; i < Math.max(lowSize, shortSize); i++) {
        const longSlice = longLowest.slice(
          i * strategiesInfo.long.symbols.size,
          (i + 1) * strategiesInfo.long.symbols.size,
        )
        const shortSlice = shortLowest.slice(
          i * strategiesInfo.short.symbols.size,
          (i + 1) * strategiesInfo.short.symbols.size,
        )
        for (const bar of longSlice) {
          longTimeSet.add(bar.time)
          const get = combinedMap.get(bar.time) || []
          get.push({ ...bar, strategy: StrategyEnum.long })
          combinedMap.set(bar.time, get)
        }
        for (const bar of shortSlice) {
          shortTimeSet.add(bar.time)
          const get = combinedMap.get(bar.time) || []
          get.push({ ...bar, strategy: StrategyEnum.short })
          combinedMap.set(bar.time, get)
        }
      }

      const combinedArray: (FullBar & { strategy: StrategyEnum })[][] =
        Array.from(combinedMap.values())

      // Initialize both strategies for controlled processing with their respective data
      await this.longBacktester.initializeForControlledProcessing(longBars)
      await this.shortBacktester.initializeForControlledProcessing(shortBars)
      const longEveryHundredBar = new Set(
        [...longTimeSet.values()].reduce((acc, time, index) => {
          if (index % 100 === 0 || acc.length === 0) {
            acc.push(time)
          }
          return acc
        }, [] as number[]),
      )
      const shortEveryHundredBar = new Set(
        [...shortTimeSet.values()].reduce((acc, time, index) => {
          if (index % 100 === 0 || acc.length === 0) {
            acc.push(time)
          }
          return acc
        }, [] as number[]),
      )
      // Process each bar sequentially and monitor unrealized P&L
      for (const _bars of combinedArray) {
        if (this._stop) {
          return
        }
        for (const bar of _bars) {
          if (bar.strategy === StrategyEnum.long) {
            this.setLongContext()
            await this.longBacktester.processBar(
              bar,
              longEveryHundredBar.has(bar.time),
            )
          } else {
            this.setShortContext()
            await this.shortBacktester.processBar(
              bar,
              shortEveryHundredBar.has(bar.time),
            )
          }
        }
        this.setLongContext()
        const longProfit = this.longBacktester.getCurrentUnrealizedPnL()
        this.setShortContext()
        const shortProfit = this.shortBacktester.getCurrentUnrealizedPnL()
        const usage = longProfit.usage + shortProfit.usage
        if (usage > 0) {
          const profit =
            longProfit.unrealizedProfit + shortProfit.unrealizedProfit
          const relativeUnPnl = (profit / usage) * 100
          if (
            (this.sharedSettings.useSl &&
              this.sharedSettings.slPerc &&
              relativeUnPnl <= +this.sharedSettings.slPerc) ||
            (this.sharedSettings.useTp &&
              this.sharedSettings.tpPerc &&
              relativeUnPnl <= +this.sharedSettings.tpPerc)
          ) {
            this.setLongContext()
            this.longBacktester.closeAllDeals()
            this.setShortContext()
            this.shortBacktester.closeAllDeals()
          }
        }
      }

      // Get the final results from both strategies
      const longResult = this.longBacktester.returnResult(new Map(), new Map())
      const shortResult = this.shortBacktester.returnResult(
        new Map(),
        new Map(),
      )

      if (!longResult || !shortResult) {
        return
      }

      return this.createHedgeResult(longResult, shortResult)
    } else {
      const longResult = await this.longBacktester.test(longBars)

      if (!longResult) {
        return
      }

      const shortResult = await this.shortBacktester.test(shortBars)

      if (!shortResult) {
        return
      }

      return this.createHedgeResult(longResult, shortResult)
    }
  }

  private createHedgeResult(
    longResult: DCABacktestingResult,
    shortResult: DCABacktestingResult,
    updateProgress?: (value: number, text: string) => void,
  ): HedgeBacktestingResult {
    updateProgress?.(90, 'Combining results...')

    // Return simplified result structure
    const result: HedgeBacktestingResult = {
      longResult,
      shortResult,
      hedgeResult: {
        financial: {
          netProfitTotal:
            longResult.financial.netProfitTotal +
            shortResult.financial.netProfitTotal,
          netProfitTotalUsd:
            longResult.financial.netProfitTotalUsd +
            shortResult.financial.netProfitTotalUsd,
          netProfitTotalPerc: 0, // Calculate properly
          grossProfit:
            longResult.financial.grossProfit +
            shortResult.financial.grossProfit,
          grossProfitUsd:
            longResult.financial.grossProfitUsd +
            shortResult.financial.grossProfitUsd,
          grossProfitPerc: 0,
          grossLoss:
            longResult.financial.grossLoss + shortResult.financial.grossLoss,
          grossLossUsd:
            longResult.financial.grossLossUsd +
            shortResult.financial.grossLossUsd,
          grossLossPerc: 0,
          avgGrossProfit: 0,
          avgGrossProfitUsd: 0,
          avgGrossProfitPerc: 0,
          avgGrossLoss: 0,
          avgGrossLossUsd: 0,
          avgGrossLossPerc: 0,
          avgNetProfit: 0,
          avgNetProfitUsd: 0,
          avgNetProfitPerc: 0,
          avgNetDaily: 0,
          avgNetDailyUsd: 0,
          avgNetDailyPerc: 0,
          unrealizedPnL:
            longResult.financial.unrealizedPnL +
            shortResult.financial.unrealizedPnL,
          unrealizedPnLUsd:
            longResult.financial.unrealizedPnLUsd +
            shortResult.financial.unrealizedPnLUsd,
          unrealizedPnLPerc: 0,
          maxDealProfit: Math.max(
            longResult.financial.maxDealProfit,
            shortResult.financial.maxDealProfit,
          ),
          maxDealLoss: Math.min(
            longResult.financial.maxDealLoss,
            shortResult.financial.maxDealLoss,
          ),
          maxDealProfitUsd: Math.max(
            longResult.financial.maxDealProfitUsd,
            shortResult.financial.maxDealProfitUsd,
          ),
          maxDealProfitPerc: Math.max(
            longResult.financial.maxDealProfitPerc,
            shortResult.financial.maxDealProfitPerc,
          ),
          maxDealLossUsd: Math.min(
            longResult.financial.maxDealLossUsd,
            shortResult.financial.maxDealLossUsd,
          ),
          maxDealLossPerc: Math.min(
            longResult.financial.maxDealLossPerc,
            shortResult.financial.maxDealLossPerc,
          ),
          maxRunUp: Math.max(
            longResult.financial.maxRunUp,
            shortResult.financial.maxRunUp,
          ),
          maxRunUpUsd: Math.max(
            longResult.financial.maxRunUpUsd,
            shortResult.financial.maxRunUpUsd,
          ),
          maxRunUpPerc: Math.max(
            longResult.financial.maxRunUpPerc,
            shortResult.financial.maxRunUpPerc,
          ),
          maxDrawDown: Math.min(
            longResult.financial.maxDrawDown,
            shortResult.financial.maxDrawDown,
          ),
          maxDrawDownUsd: Math.min(
            longResult.financial.maxDrawDownUsd,
            shortResult.financial.maxDrawDownUsd,
          ),
          maxDrawDownPerc: Math.min(
            longResult.financial.maxDrawDownPerc,
            shortResult.financial.maxDrawDownPerc,
          ),
          initialBalanceUsd:
            longResult.financial.initialBalanceUsd +
            shortResult.financial.initialBalanceUsd,
        },
        duration: {
          avgDealDuration:
            (longResult.duration.avgDealDuration +
              shortResult.duration.avgDealDuration) /
            2,
          avgSplitDealDuration: longResult.duration.avgSplitDealDuration,
          firstDataTime: Math.min(
            longResult.duration.firstDataTime,
            shortResult.duration.firstDataTime,
          ),
          lastDataTime: Math.max(
            longResult.duration.lastDataTime,
            shortResult.duration.lastDataTime,
          ),
          loadingDataTime: Math.max(
            longResult.duration.loadingDataTime,
            shortResult.duration.loadingDataTime,
          ),
          processingDataTime:
            longResult.duration.processingDataTime +
            shortResult.duration.processingDataTime,
          botWorkingTime: longResult.duration.botWorkingTime,
          maxDealDuration: longResult.duration.maxDealDuration,
          maxDealDurationTime: Math.max(
            longResult.duration.maxDealDurationTime,
            shortResult.duration.maxDealDurationTime,
          ),
          botWorkingTimeNumber: Math.max(
            longResult.duration.botWorkingTimeNumber,
            shortResult.duration.botWorkingTimeNumber,
          ),
        },
        usage: {
          maxTheoreticalUsage:
            longResult.usage.maxTheoreticalUsage +
            shortResult.usage.maxTheoreticalUsage,
          maxRealUsage:
            longResult.usage.maxRealUsage + shortResult.usage.maxRealUsage,
          avgRealUsage:
            (longResult.usage.avgRealUsage + shortResult.usage.avgRealUsage) /
            2,
        },
        numerical: {
          all: longResult.numerical.all + shortResult.numerical.all,
          profit: longResult.numerical.profit + shortResult.numerical.profit,
          loss: longResult.numerical.loss + shortResult.numerical.loss,
          open: longResult.numerical.open + shortResult.numerical.open,
          closed: longResult.numerical.closed + shortResult.numerical.closed,
          maxConsecutiveWins: Math.max(
            longResult.numerical.maxConsecutiveWins,
            shortResult.numerical.maxConsecutiveWins,
          ),
          maxConsecutiveLosses: Math.max(
            longResult.numerical.maxConsecutiveLosses,
            shortResult.numerical.maxConsecutiveLosses,
          ),
          maxDCATriggered: Math.max(
            longResult.numerical.maxDCATriggered,
            shortResult.numerical.maxDCATriggered,
          ),
          avgDCATriggered:
            (longResult.numerical.avgDCATriggered +
              shortResult.numerical.avgDCATriggered) /
            2,
          dealsPerDay:
            longResult.numerical.dealsPerDay +
            shortResult.numerical.dealsPerDay,
          coveredPriceDeviation: Math.max(
            longResult.numerical.coveredPriceDeviation,
            shortResult.numerical.coveredPriceDeviation,
          ),
          actualPriceDeviation: Math.max(
            longResult.numerical.actualPriceDeviation,
            shortResult.numerical.actualPriceDeviation,
          ),
        },
        ratios: {
          profitFactor: this.calculateCombinedProfitFactor(
            longResult.financial.grossProfit,
            longResult.financial.grossLoss,
            shortResult.financial.grossProfit,
            shortResult.financial.grossLoss,
          ),
          profitByPeriod: this.combineProfitByPeriod(
            longResult.ratios.profitByPeriod,
            shortResult.ratios.profitByPeriod,
          ),
          buyAndHold: {
            value:
              longResult.ratios.buyAndHold.value +
              shortResult.ratios.buyAndHold.value,
            valueUsd:
              longResult.ratios.buyAndHold.valueUsd +
              shortResult.ratios.buyAndHold.valueUsd,
            perc: this.calculateCombinedPercentage(
              longResult.ratios.buyAndHold.value,
              longResult.financial.initialBalanceUsd,
              shortResult.ratios.buyAndHold.value,
              shortResult.financial.initialBalanceUsd,
            ),
          },
          periodRatio:
            (longResult.ratios.periodRatio + shortResult.ratios.periodRatio) /
            2,
          sharpe: (longResult.ratios.sharpe + shortResult.ratios.sharpe) / 2,
          sortino: (longResult.ratios.sortino + shortResult.ratios.sortino) / 2,
          cwr: (longResult.ratios.cwr + shortResult.ratios.cwr) / 2,
        },
      },
    }

    updateProgress?.(100, 'Hedge backtest complete')
    return result
  }

  private calculateCombinedPercentage(
    longValue: number,
    longBase: number,
    shortValue: number,
    shortBase: number,
  ): number {
    const totalValue = longValue + shortValue
    const totalBase = longBase + shortBase
    return totalBase > 0 ? (totalValue / totalBase) * 100 : 0
  }

  private calculateCombinedProfitFactor(
    longGrossProfit: number,
    longGrossLoss: number,
    shortGrossProfit: number,
    shortGrossLoss: number,
  ): number {
    const totalGrossProfit = longGrossProfit + shortGrossProfit
    const totalGrossLoss = Math.abs(longGrossLoss) + Math.abs(shortGrossLoss)
    return totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : 0
  }

  private combineProfitByPeriod(
    longProfitByPeriod: number[],
    shortProfitByPeriod: number[],
  ): number[] {
    const maxLength = Math.max(
      longProfitByPeriod.length,
      shortProfitByPeriod.length,
    )
    const combined: number[] = []

    for (let i = 0; i < maxLength; i++) {
      const longValue = longProfitByPeriod[i] || 0
      const shortValue = shortProfitByPeriod[i] || 0
      combined.push(longValue + shortValue)
    }

    return combined
  }

  public getTestingPeriod() {
    // Use the testing period from long backtest (should be same for both)
    return this.longBacktester.getTestingPeriod()
  }
}

export default HedgeBacktesting
