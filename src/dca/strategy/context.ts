import type {
  ExchangeIntervals,
  FullBar,
  Deal,
  Profit,
  IndicatorsEvents,
  PositionSide,
  EdgeBacktestEnum,
  DCABacktestingResult,
} from '../../types'
import type { Indicator } from './ti/index'

/**
 * Data type for strategy data arrays
 */
type DataType = { bar: FullBar[]; interval: ExchangeIntervals }

/**
 * Strategy execution context - holds all shared state for a strategy instance
 * This replaces static properties to allow multiple isolated strategy instances
 */
export class StrategyContext {
  // Core execution flags
  public combo = false
  public rangeStatus = false
  public preventOpen = false
  public trades?: boolean
  public useFile?: boolean
  public fullResult?: boolean

  // Time and progress tracking
  public portfolioTimes: Set<string> = new Set()
  public candleTimes: Set<string> = new Set()
  public lastIndex = 0
  public transactionIndex = 0
  public start = 0

  // State management
  public status: 'open' | 'closed' | 'monitoring' = 'open'
  public messages: string[] = []
  public workingShift: { start: number; end?: number }[] = []

  // Data storage
  public data: DataType[] = []
  public dataMap: Map<ExchangeIntervals, Map<string, FullBar>> = new Map()
  public portfolio: Map<number, number> = new Map()
  public indicatorEvents: IndicatorsEvents[] = []
  public indicators: Indicator[] = []

  // Intervals
  public interval?: ExchangeIntervals
  public lowestInterval?: ExchangeIntervals
  public highestInterval?: ExchangeIntervals

  // Deal management
  public dealsBySymbolsStatusId: Map<string, Map<string, Map<string, Deal>>> =
    new Map()
  public lastOpenedDeal = 0
  public lastClosedDeal = 0
  public lastOpenedDealPerSymbol: Map<string, number> = new Map()
  public lastClosedDealPerSymbol: Map<string, number> = new Map()
  public lastPricesPerSymbol: Map<string, { avg: number; entry: number }> =
    new Map()
  public lastPrice: Map<string, number> = new Map()
  public previousDeal?: Deal

  // Financial tracking
  public profits: Profit[] = []
  public totalProfit = 0
  public totalProfitUsd = 0
  public totalProfitPerSymbol: Map<string, number> = new Map()
  public totalProfitUsdPerSymbol: Map<string, number> = new Map()

  // Statistics
  public maxConsecutiveWins = 0
  public maxConsecutiveLosses = 0
  public maxProfit = {
    asset: 0,
    usd: 0,
    perc: 0,
  }
  public maxLoss = {
    asset: 0,
    usd: 0,
    perc: 0,
  }
  public seriesWin = {
    count: 0,
    value: 0,
    valueUsd: 0,
    min: 0,
    minUsd: 0,
    max: 0,
    maxUsd: 0,
    perc: 0,
  }
  public seriesLossE = {
    valueUsd: 0,
    minUsd: 0,
    maxUsd: 0,
    perc: 0,
  }
  public seriesLoss = {
    count: 0,
    value: 0,
    valueUsd: 0,
    min: 0,
    minUsd: 0,
    max: 0,
    maxUsd: 0,
    perc: 0,
  }

  // Usage tracking
  public maxUsage = {
    deal: 0,
    bot: 0,
    botQuote: 0,
  }

  // Price tracking
  public next: Map<string, number> = new Map()
  public minPrice: Map<string, number> = new Map()
  public maxPrice: Map<string, number> = new Map()
  public priceMin = 0
  public priceMax = 0

  // Position management
  public emptyPosition = {
    qty: 0,
    entryPrice: 0,
    liquidationPrice: 0,
    side: 'LONG' as PositionSide,
  }
  public position: Map<string, typeof this.emptyPosition> = new Map()
  public balance: Map<string, number> = new Map()
  public balanceUsd = 0
  public initialBalance = 0
  public balanceForProfit = 0
  public startRate = 0
  public initialBalanceUsd = 0
  public previousValues = 0
  public previousValuesInAsset = new Map<
    string,
    { base: number; quote: number }
  >()

  // Additional tracking maps
  public lowestDataForBnH: Map<number, FullBar> = new Map()
  public lowestDataForBnHSymbol = ''
  public edge?: EdgeBacktestEnum
  public previousResult?: DCABacktestingResult
  public multi = false

  // Reset all data to initial state
  public resetData(): void {
    this.data = []
    this.portfolio.clear()
    this.portfolioTimes.clear()
    this.candleTimes.clear()
    this.indicatorEvents = []
    this.workingShift = []
    this.messages = []
    this.dealsBySymbolsStatusId.clear()
    this.profits = []
    this.rangeStatus = false
    this.lastIndex = 0
    this.transactionIndex = 0
    this.lastOpenedDeal = 0
    this.lastClosedDeal = 0
    this.lastOpenedDealPerSymbol.clear()
    this.lastClosedDealPerSymbol.clear()
    this.lastPricesPerSymbol.clear()
    this.totalProfit = 0
    this.totalProfitUsd = 0
    this.totalProfitPerSymbol.clear()
    this.totalProfitUsdPerSymbol.clear()
    this.maxConsecutiveWins = 0
    this.maxConsecutiveLosses = 0
    this.next.clear()
    this.minPrice.clear()
    this.maxPrice.clear()
    this.position.clear()
    this.balance.clear()
    this.balanceUsd = 0
    this.initialBalance = 0
    this.balanceForProfit = 0
    this.startRate = 0
    this.initialBalanceUsd = 0
    this.lowestDataForBnH.clear()
    this.dataMap.clear()
    this.indicators = []
    this.previousDeal = undefined
    this.priceMin = 0
    this.priceMax = 0
    this.previousValues = 0
    this.previousValuesInAsset.clear()
    this.edge = undefined
    this.previousResult = undefined
    this.multi = false
    this.lowestDataForBnHSymbol = ''

    // Reset statistics
    this.maxProfit = { asset: 0, usd: 0, perc: 0 }
    this.maxLoss = { asset: 0, usd: 0, perc: 0 }
    this.seriesWin = {
      count: 0,
      value: 0,
      valueUsd: 0,
      min: 0,
      minUsd: 0,
      max: 0,
      maxUsd: 0,
      perc: 0,
    }
    this.seriesLossE = { valueUsd: 0, minUsd: 0, maxUsd: 0, perc: 0 }
    this.seriesLoss = {
      count: 0,
      value: 0,
      valueUsd: 0,
      min: 0,
      minUsd: 0,
      max: 0,
      maxUsd: 0,
      perc: 0,
    }
    this.maxUsage = { deal: 0, bot: 0, botQuote: 0 }
    this.lastPrice = new Map()
  }

  // Get deals from context
  public getDeals(status?: Deal['status'], symbol?: string): Deal[] {
    const deals: Deal[] = []
    for (const symbolMap of this.dealsBySymbolsStatusId.values()) {
      for (const statusMap of symbolMap.values()) {
        for (const deal of statusMap.values()) {
          if (!status || deal.status === status) {
            if (
              !symbol ||
              deal.symbol.pair === symbol ||
              deal.symbol.pair.includes(symbol)
            ) {
              deals.push(deal)
            }
          }
        }
      }
    }
    return deals
  }

  // Get deals count from context
  public getDealsCount(status?: Deal['status'], symbol?: string): number {
    return this.getDeals(status, symbol).length
  }

  // Clone context for new instances (creates fresh isolated context)
  public clone(): StrategyContext {
    const newContext = new StrategyContext()
    // Don't copy data/state - each instance should have fresh state
    newContext.fullResult = this.fullResult
    newContext.useFile = this.useFile
    newContext.combo = this.combo
    return newContext
  }
}

/**
 * Context manager for handling multiple strategy contexts
 */
export class StrategyContextManager {
  private static contexts = new Map<string, StrategyContext>()
  private static activeContext = 'default'

  // Set the active context for current execution
  public static setActiveContext(contextId: string): void {
    if (!this.contexts.has(contextId)) {
      this.contexts.set(contextId, new StrategyContext())
    }
    this.activeContext = contextId
  }

  // Get the current active context
  public static getActiveContext(): StrategyContext {
    if (!this.contexts.has(this.activeContext)) {
      this.contexts.set(this.activeContext, new StrategyContext())
    }
    return this.contexts.get(this.activeContext)!
  }

  // Get specific context by id
  public static getContext(contextId: string): StrategyContext {
    if (!this.contexts.has(contextId)) {
      this.contexts.set(contextId, new StrategyContext())
    }
    return this.contexts.get(contextId)!
  }

  // Reset a specific context
  public static resetContext(contextId: string): void {
    const context = this.getContext(contextId)
    context.resetData()
  }

  // Clean up context
  public static removeContext(contextId: string): void {
    this.contexts.delete(contextId)
  }

  // Get current active context id
  public static getActiveContextId(): string {
    return this.activeContext
  }
}

// Global default context for backward compatibility
export const globalStrategyContext = new StrategyContext()
