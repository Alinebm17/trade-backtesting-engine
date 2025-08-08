import Backtesting from '..'
import DCABacktesting from '../dca'
import { v4 } from 'uuid'

import {
  ExchangeIntervals,
  FullBar,
  DCABacktestingInput,
  DCABotSettings,
  DCABacktestingResult,
} from '../types'

export type HedgeBotSettings = Pick<
  DCABotSettings,
  | 'useTp'
  | 'tpPerc'
  | 'useSl'
  | 'slPerc'
  | 'comboTpBase'
  | 'dealCloseConditionSL'
  | 'dealCloseCondition'
>

export interface HedgeBacktestingInput
  extends Omit<DCABacktestingInput, 'settings'> {
  longSettings: DCABotSettings
  shortSettings: DCABotSettings
  sharedSettings?: HedgeBotSettings
}

export interface HedgeBacktestingResult {
  longResult: DCABacktestingResult
  shortResult: DCABacktestingResult
  hedgeResult: Pick<
    DCABacktestingResult,
    'financial' | 'duration' | 'usage' | 'numerical' | 'ratios'
  >
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

    // Create unique combinations of interval @ symbol @ exchange
    const uniqueCombinations = new Map<
      string,
      {
        interval: ExchangeIntervals
        countBack: number
      }
    >()

    // Process long strategy intervals
    for (const intervalInfo of longIntervals) {
      for (const [, symbol] of longSymbols) {
        const key = `${intervalInfo.interval}@${symbol.pair}@${longExchange}`
        const existing = uniqueCombinations.get(key)
        if (!existing || existing.countBack < intervalInfo.countBack) {
          uniqueCombinations.set(key, intervalInfo)
        }
      }
    }

    // Process short strategy intervals
    for (const intervalInfo of shortIntervals) {
      for (const [, symbol] of shortSymbols) {
        const key = `${intervalInfo.interval}@${symbol.pair}@${shortExchange}`
        const existing = uniqueCombinations.get(key)
        if (!existing || existing.countBack < intervalInfo.countBack) {
          uniqueCombinations.set(key, intervalInfo)
        }
      }
    }

    // Return unique intervals (grouped by interval, taking max countBack)
    const intervalMap = new Map<ExchangeIntervals, number>()
    for (const intervalInfo of uniqueCombinations.values()) {
      const existing = intervalMap.get(intervalInfo.interval)
      if (!existing || existing < intervalInfo.countBack) {
        intervalMap.set(intervalInfo.interval, intervalInfo.countBack)
      }
    }

    return Array.from(intervalMap.entries()).map(([interval, countBack]) => ({
      interval,
      countBack,
    }))
  }

  private filterSupportedIntervals(
    intervals: { interval: ExchangeIntervals; countBack: number }[],
  ) {
    // TODO: Implement proper exchange-specific interval filtering
    // For now, return all intervals as a placeholder
    // This should filter based on:
    // - Exchange capabilities (binanceSupported, bybitSupported, etc.)
    // - Symbol requirements
    // - Strategy-specific needs

    return intervals
  }

  public async test(
    bars?: { bar: FullBar[]; interval: ExchangeIntervals }[],
    updateProgress?: (value: number, text: string) => void,
    loadDataCallBack?: () => void,
  ): Promise<HedgeBacktestingResult | undefined> {
    if (this._stop) {
      return
    }

    // Load shared data only for supported intervals, exchanges, and symbols
    let sharedBars: { bar: FullBar[]; interval: ExchangeIntervals }[] = []

    if (!bars) {
      updateProgress?.(0, 'Loading shared candle data...')
      const testPeriod = this.longBacktester.getTestingPeriod()
      if (testPeriod) {
        const otherIntervals = this.getOtherIntervals()

        // Filter intervals to only those supported by both exchanges
        const supportedIntervals = this.filterSupportedIntervals(otherIntervals)

        // Load data only for intervals that are supported by both strategies
        for (const intervalInfo of supportedIntervals) {
          const data = await this._loadData(intervalInfo.interval)
          sharedBars.push({ bar: data, interval: intervalInfo.interval })
        }

        const mainData = await this._loadData(this.interval)
        sharedBars.push({ bar: mainData, interval: this.interval })
      }
    } else {
      sharedBars = bars
    }

    loadDataCallBack?.()

    updateProgress?.(20, 'Checking controlled processing support...')

    // Check if both strategies support controlled bar processing
    const longSupportsControlled =
      this.longBacktester.supportsControlledProcessing()
    const shortSupportsControlled =
      this.shortBacktester.supportsControlledProcessing()

    if (
      longSupportsControlled &&
      shortSupportsControlled &&
      this.sharedSettings
    ) {
      // Use controlled bar-by-bar processing
      updateProgress?.(30, 'Initializing controlled processing...')

      // Initialize both strategies for controlled processing
      await this.longBacktester.initializeForControlledProcessing(sharedBars)
      await this.shortBacktester.initializeForControlledProcessing(sharedBars)

      // Get the main interval bars for processing
      const mainIntervalBars =
        sharedBars.find((b) => b.interval === this.interval)?.bar || []

      updateProgress?.(40, 'Processing bars with hedge monitoring...')

      // Process each bar sequentially and monitor unrealized P&L
      for (let i = 0; i < mainIntervalBars.length; i++) {
        if (this._stop) {
          return
        }

        const bar = mainIntervalBars[i]

        // Process the bar in both strategies
        await this.longBacktester.processBar(bar, this.interval, true)
        await this.shortBacktester.processBar(bar, this.interval, true)

        // Check unrealized P&L after processing the bar
        if (this.shouldCheckHedge(i, mainIntervalBars.length)) {
          const longUnrealizedPnL =
            this.longBacktester.getCurrentUnrealizedPnL()
          const shortUnrealizedPnL =
            this.shortBacktester.getCurrentUnrealizedPnL()

          // Check if hedge conditions are met
          if (
            this.checkHedgeConditions(longUnrealizedPnL, shortUnrealizedPnL)
          ) {
            updateProgress?.(
              40 + (i / mainIntervalBars.length) * 40,
              'Hedge conditions met - implementing hedge actions...',
            )

            // TODO: Implement hedge actions (close deals, etc.)
            break
          }
        }

        // Update progress
        if (i % Math.floor(mainIntervalBars.length / 20) === 0) {
          updateProgress?.(
            40 + (i / mainIntervalBars.length) * 40,
            `Processing bar ${i + 1}/${mainIntervalBars.length}`,
          )
        }
      }

      updateProgress?.(80, 'Finalizing controlled processing results...')

      // Get the final results from both strategies
      const longResult = this.longBacktester.returnResult(new Map(), new Map())
      const shortResult = this.shortBacktester.returnResult(
        new Map(),
        new Map(),
      )

      if (!longResult || !shortResult) {
        return
      }

      return this.createHedgeResult(longResult, shortResult, updateProgress)
    } else {
      // Fall back to sequential processing without controlled bar processing
      updateProgress?.(
        30,
        'Using sequential processing (no controlled support)...',
      )

      const longResult = await this.longBacktester.test(
        sharedBars,
        (progress, text) => {
          updateProgress?.(30 + progress * 0.25, `Long: ${text}`)
        },
      )

      if (!longResult) {
        return
      }

      const shortResult = await this.shortBacktester.test(
        sharedBars,
        (progress, text) => {
          updateProgress?.(55 + progress * 0.25, `Short: ${text}`)
        },
      )

      if (!shortResult) {
        return
      }

      return this.createHedgeResult(longResult, shortResult, updateProgress)
    }
  }

  private shouldCheckHedge(
    currentBarIndex: number,
    totalBars: number,
  ): boolean {
    // Check hedge conditions every N bars or based on settings
    // For now, check every 10 bars or every 1% of total bars
    const checkFrequency = Math.max(10, Math.floor(totalBars / 100))
    return currentBarIndex % checkFrequency === 0
  }

  private checkHedgeConditions(
    longUnrealizedPnL: ReturnType<DCABacktesting['getCurrentUnrealizedPnL']>,
    shortUnrealizedPnL: ReturnType<DCABacktesting['getCurrentUnrealizedPnL']>,
  ): boolean {
    if (!this.sharedSettings) {
      return false
    }

    const totalUnrealizedPnLUsd =
      longUnrealizedPnL.totalUnrealizedPnLUsd +
      shortUnrealizedPnL.totalUnrealizedPnLUsd

    // Check TP conditions
    if (this.sharedSettings.useTp && this.sharedSettings.tpPerc) {
      const tpThreshold = parseFloat(this.sharedSettings.tpPerc)
      if (totalUnrealizedPnLUsd > 0) {
        // Calculate percentage based on usage or implement proper calculation
        // For now, use simplified check
        return totalUnrealizedPnLUsd >= tpThreshold
      }
    }

    // Check SL conditions
    if (this.sharedSettings.useSl && this.sharedSettings.slPerc) {
      const slThreshold = parseFloat(this.sharedSettings.slPerc)
      if (totalUnrealizedPnLUsd < 0) {
        // Calculate percentage based on usage or implement proper calculation
        return Math.abs(totalUnrealizedPnLUsd) >= slThreshold
      }
    }

    return false
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
          profitFactor: 0, // Calculate properly
          profitByPeriod: [], // Combine properly
          buyAndHold: {
            value: 0,
            valueUsd: 0,
            perc: 0,
          },
          periodRatio: 0,
          sharpe: 0,
          sortino: 0,
          cwr: 0,
        },
      },
    }

    updateProgress?.(100, 'Hedge backtest complete')
    return result
  }

  public getTestingPeriod() {
    // Use the testing period from long backtest (should be same for both)
    return this.longBacktester.getTestingPeriod()
  }
}

export default HedgeBacktesting
