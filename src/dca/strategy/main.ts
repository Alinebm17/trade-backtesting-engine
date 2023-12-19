import { v4 } from 'uuid'
import { checkNumber } from '../../helper/utils'
import DCABotFunctions from '../../helper/dcaBotFunctions'
import ComboBotFunctions from '../../helper/comboBotFunctions'
import {
  DCAOrderTypeEnum,
  StrategyEnum,
  BotOrderSideEnum,
  ExchangeIntervals,
  CooldownUnits,
  TrailingModeEnum,
  CloseConditionEnum,
  PositionSide,
  BotMarginTypeEnum,
  StartConditionEnum,
  FuturesStrategyEnum,
  BacktestingTransaction,
  DCAConditionEnum,
  IndicatorAction,
  timeIntervalMap,
  OrderSizeTypeEnum,
} from '../../types'
import { friendlyTime } from '../../helper/timeFunctions'
import { MathHelper } from '../../helper/math'
import findUSDRate from '../../helper/price'
import type { Indicator } from './ti/index'

import type {
  DCABotSettings,
  Deal,
  DCAGrid,
  FullGrid,
  Symbols,
  DCABacktestingResult,
  Prices,
  Asset,
  Bar as BarTV,
  Minigrid,
  TradeResponse,
  Profit,
  IndicatorsEvents,
  BuyAndHoldEquity,
  EdgeBacktestEnum,
  FullBar,
  SymbolStats,
} from '../../types'

export type Bar = BarTV

export type StrategyInput = {
  settings: DCABotSettings
  symbols: Symbols[]
  userFee: number
  prices: Prices
  interval: ExchangeIntervals
  balances?: Asset[] | null
  slippage?: number
  combo?: boolean
  trades?: boolean
  edge?: EdgeBacktestEnum
  previousData?: DCABacktestingResult
  multi?: boolean
  timezone?: string | null
}

export type DataType = {
  bar: FullBar[]
  interval: ExchangeIntervals
}

export interface StrategyInterface {
  getOtherIntervals(): { interval: ExchangeIntervals; countBack: number }[]
  loadData(data: DataType[], start?: number): void
  test(updateProgress?: (value: number, text: string) => void): Promise<void>
  preTest(): Promise<void>
  startWorkingShift(start: number): void
  processBar(bar: FullBar, nextBar?: FullBar): Promise<void>
  processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar | null; interval: ExchangeIntervals }[],
  ): void
  passTradeCandleData?: (
    trade: TradeResponse,
    candles: { candle: FullBar | null; interval: ExchangeIntervals }[],
  ) => void
  openDeal(
    price: number,
    startTime: number,
    high: number,
    low: number,
    symbol: string,
  ): void
  checkDeals(b: FullBar, cbClose?: (price: number) => void): void
  checkInRange(price: number, time: number): boolean
  returnResult(
    firstData: Map<string, FullBar>,
    lastData: Map<string, FullBar>,
    loadingTime: number,
    processingTime: number,
  ): DCABacktestingResult
  long: boolean
  profitBase: boolean
  stop: boolean
}

enum CandleTypeEnum {
  bull = 'bull',
  bear = 'bear',
}

export abstract class Strategy implements StrategyInterface {
  static indicatorEvents: IndicatorsEvents[] = []

  static emptyPositon = {
    qty: 0,
    entryPrice: 0,
    liquidationPrice: 0,
    side: PositionSide.LONG,
  }

  public settings: DCABotSettings

  private readonly botFunctions: Map<string, DCABotFunctions> = new Map()

  static workingShift: { start: number; end?: number }[] = []

  static rangeStatus = false

  static maxUsage: {
    deal: number
    bot: number
    botQuote: number
  } = {
    deal: 0,
    bot: 0,
    botQuote: 0,
  }

  static deals: Deal[] = []

  static profits: Profit[] = []

  private filterFn: {
    filledOrders: (b: FullBar) => (o: FullGrid) => boolean
    filledTp: (b: FullBar) => (o: FullGrid) => boolean
  }

  static maxProfit = 0

  static maxLoss = 0

  static maxProfitUsd = 0

  static maxLossUsd = 0

  static seriesWin = {
    count: 0,
    value: 0,
    valueUsd: 0,
    min: 0,
    minUsd: 0,
    max: 0,
    maxUsd: 0,
    perc: 0,
  }

  static seriesLoss = {
    count: 0,
    value: 0,
    valueUsd: 0,
    min: 0,
    minUsd: 0,
    max: 0,
    maxUsd: 0,
    perc: 0,
  }

  static previousDeal?: Deal

  static maxConsecutiveWins = 0

  static maxConsecutiveLosses = 0

  static totalProfit = 0

  static totalProfitPerSymbol: Map<string, number> = new Map()

  static totalProfitUsdPerSymbol: Map<string, number> = new Map()

  static totalProfitUsd = 0

  protected math = new MathHelper()

  private readonly userFee: number

  private readonly usdRate: Map<string, number> = new Map()

  private readonly usdRateQuote: Map<string, number> = new Map()

  private readonly usdRateBase: Map<string, number> = new Map()

  private readonly precision: Map<string, number> = new Map()

  private readonly precisionQuote: Map<string, number> = new Map()

  private readonly precisionBase: Map<string, number> = new Map()

  private readonly prices: Prices

  private readonly symbols: Map<string, Symbols> = new Map()

  private readonly balances?: Asset[] | null

  static interval: ExchangeIntervals

  static data: DataType[] = []

  private readonly slippage?: number

  static lastOpenedDeal = 0

  static lastClosedDeal = 0

  static lowestInterval?: ExchangeIntervals

  static indicators: Indicator[] = []

  static next: Map<string, number> = new Map()

  static transactionIndex = 0

  static minPrice: Map<string, number> = new Map()

  static maxPrice: Map<string, number> = new Map()

  static start = 0

  static resetData() {
    Strategy.start = 0
    Strategy.workingShift = []
    Strategy.maxUsage = {
      deal: 0,
      bot: 0,
      botQuote: 0,
    }
    Strategy.deals = []
    Strategy.profits = []
    Strategy.maxProfit = 0
    Strategy.maxLoss = 0
    Strategy.maxProfitUsd = 0
    Strategy.maxLossUsd = 0
    Strategy.seriesWin = {
      count: 0,
      value: 0,
      valueUsd: 0,
      min: 0,
      minUsd: 0,
      max: 0,
      maxUsd: 0,
      perc: 0,
    }
    Strategy.seriesLoss = {
      count: 0,
      value: 0,
      valueUsd: 0,
      min: 0,
      minUsd: 0,
      max: 0,
      maxUsd: 0,
      perc: 0,
    }
    Strategy.previousDeal = undefined
    Strategy.maxConsecutiveWins = 0
    Strategy.maxConsecutiveLosses = 0
    Strategy.totalProfit = 0
    Strategy.totalProfitPerSymbol = new Map()
    Strategy.totalProfitUsdPerSymbol = new Map()
    Strategy.totalProfitUsd = 0
    Strategy.lastOpenedDeal = 0
    Strategy.lastClosedDeal = 0
    Strategy.lowestInterval = undefined
    Strategy.indicators = []
    Strategy.data = []
    Strategy.next = new Map()
    Strategy.rangeStatus = false
    Strategy.transactionIndex = 0
    Strategy.minPrice = new Map()
    Strategy.maxPrice = new Map()
    Strategy.trades = false
    Strategy.indicatorEvents = []
    Strategy.balance = 0
    Strategy.balanceUsd = 0
    Strategy.initialBalance = 0
    Strategy.initialBalanceUsd = 0
    Strategy.position = new Map()
    Strategy.edge = undefined
    Strategy.previousResult = undefined
    Strategy.multi = false
    Strategy.initialBalanceSymbol = ''
  }

  static position: Map<string, typeof Strategy.emptyPositon> = new Map()

  private combo = false

  private usedOrderId: Set<string> = new Set()

  static trades?: boolean

  public _stop = false

  static balance = 0

  static balanceUsd = 0

  static initialBalance = 0

  static initialBalanceSymbol = ''

  static initialBalanceUsd = 0

  static edge?: EdgeBacktestEnum

  static previousResult?: DCABacktestingResult

  static multi = false

  constructor(input: StrategyInput) {
    const {
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
    } = input
    if (!combo) {
      Strategy.edge = edge
      Strategy.previousResult = previousData
    }
    Strategy.multi = !!multi
    Strategy.trades = trades
    this.combo = !!combo
    this.settings = settings

    this.filterFn = {
      filledOrders: this.long
        ? (b: FullBar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.high <= o.price
        : (b: FullBar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.low >= o.price,
      filledTp: this.long
        ? (b: FullBar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.low >= o.price
        : (b: FullBar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.high <= o.price,
    }
    for (const s of symbols) {
      const bu = this.combo
        ? new ComboBotFunctions(settings, s, userFee, trades)
        : new DCABotFunctions(settings, s, userFee)
      this.symbols.set(s.pair, s)
      this.botFunctions.set(s.pair, bu)
      this.usdRate.set(
        s.pair,
        findUSDRate(
          this.profitBase ? s.baseAsset.name : s.quoteAsset.name,
          prices,
        ),
      )
      this.usdRateQuote.set(s.pair, findUSDRate(s.quoteAsset.name, prices))
      this.usdRateBase.set(s.pair, findUSDRate(s.baseAsset.name, prices))
      this.precision.set(
        s.pair,
        bu.utils.getPrecision(s)[this.profitBase ? 'base' : 'quote'] + 3,
      )
      this.precisionQuote.set(s.pair, bu.utils.getPrecision(s).quote)
      this.precisionBase.set(s.pair, bu.utils.getPrecision(s).base)
    }
    this.userFee = userFee
    this.openDeal = this.openDeal.bind(this)
    this.checkDeals = this.checkDeals.bind(this)
    this.prices = prices
    Strategy.interval = interval
    this.balances = balances
    this.slippage = slippage
  }

  public set stop(value: boolean) {
    this._stop = value
  }

  public set settingsUpdate(settings: DCABotSettings) {
    this.settings = settings
  }

  public loadData(data: DataType[], start?: number): void {
    Strategy.start = start ?? 0
    Strategy.data = data
  }

  public getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    return []
  }

  public abstract test(): Promise<void>

  public abstract preTest(): Promise<void>

  public startWorkingShift(start: number): void {
    Strategy.workingShift.push({ start })
  }

  public abstract processBar(bar: FullBar, nextBar?: FullBar): Promise<void>

  public abstract processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar | null; interval: ExchangeIntervals }[],
  ): void

  public checkInRange(price: number, time: number) {
    const { maxOpenDeal, minOpenDeal, useMulti } = this.settings
    if (useMulti) {
      return true
    }
    let result = true
    if (maxOpenDeal || minOpenDeal) {
      if (maxOpenDeal && !minOpenDeal) {
        result = price <= +maxOpenDeal
      }
      if (minOpenDeal && !maxOpenDeal) {
        result = price >= +minOpenDeal
      }
      if (maxOpenDeal && minOpenDeal) {
        result = price >= +minOpenDeal && price <= +maxOpenDeal
      }
    }
    const last = Strategy.workingShift[Strategy.workingShift.length - 1]
    if (!result && Strategy.workingShift.length > 0 && !Strategy.rangeStatus) {
      if (!last.end) {
        last.end = time
        Strategy.workingShift = [
          ...Strategy.workingShift.filter((ws) => ws.start !== last.start),
          last,
        ]
      }
      Strategy.rangeStatus = true
    }
    if (result && Strategy.rangeStatus) {
      Strategy.rangeStatus = false
      if (last.end) {
        Strategy.workingShift.push({ start: time })
      }
    }
    return result
  }

  private checkMaxDealsPerPair(symbol: string) {
    const { useMulti, maxDealsPerPair } = this.settings
    if (useMulti && maxDealsPerPair && maxDealsPerPair !== '') {
      const max = +maxDealsPerPair
      if (max && !isNaN(max) && max > 0) {
        const symbolDealsLength = Strategy.deals.filter(
          (d) => d.status === 'open' && d.symbol.pair === symbol,
        ).length
        if (symbolDealsLength < max) {
          return true
        }
        return false
      }
    }
    return true
  }

  private checkMaxDeals(symbol: string) {
    const { maxNumberOfOpenDeals } = this.settings
    if (maxNumberOfOpenDeals && maxNumberOfOpenDeals !== '') {
      const max = +maxNumberOfOpenDeals
      if (max && !isNaN(max) && max > 0) {
        const dealsLength = Strategy.deals.filter(
          (d) => d.status === 'open',
        ).length

        if (dealsLength < max) {
          if (this.checkMaxDealsPerPair(symbol)) {
            return true
          }
        }
        return false
      }
    }
    return true
  }

  private convertCooldown(interval?: number, units?: CooldownUnits) {
    if (!interval || !units) {
      return 0
    }
    return (
      interval *
      (units === CooldownUnits.seconds
        ? 1000
        : units === CooldownUnits.minutes
        ? 60 * 1000
        : units === CooldownUnits.hours
        ? 60 * 60 * 1000
        : 24 * 60 * 60 * 1000)
    )
  }

  private checkCooldownStart(time: number) {
    if (this.settings.cooldownAfterDealStart) {
      return (
        time - Strategy.lastOpenedDeal >=
        this.convertCooldown(
          this.settings.cooldownAfterDealStartInterval,
          this.settings.cooldownAfterDealStartUnits,
        )
      )
    }
    return true
  }

  private checkCooldownStop(time: number) {
    if (this.settings.cooldownAfterDealStop) {
      return (
        time - Strategy.lastClosedDeal >=
        this.convertCooldown(
          this.settings.cooldownAfterDealStopInterval,
          this.settings.cooldownAfterDealStopUnits,
        )
      )
    }
    return true
  }

  get leverage() {
    return this.settings.futures
      ? this.settings.marginType !== BotMarginTypeEnum.inherit
        ? this.settings.leverage ?? 1
        : 1
      : 1
  }

  get futures() {
    return this.settings.futures
  }

  get coinm() {
    return this.settings.coinm
  }

  private updatePositionWithOrder(order: DCAGrid, s: string) {
    if (this.futures) {
      let position = Strategy.position.get(s)
      if (!position) {
        position = Strategy.emptyPositon
      }
      const margin = order.qty
      const sameDirection =
        (position.side === PositionSide.LONG &&
          order.side === BotOrderSideEnum.buy) ||
        (position.side === PositionSide.SHORT &&
          order.side === BotOrderSideEnum.sell)
      const liquidationPrice = (entryPrice: number, pos: PositionSide) =>
        entryPrice *
        (this.leverage > 1
          ? 1 + (1 / this.leverage) * (pos === PositionSide.LONG ? -1 : 1) /* *
              (1 + this.userFee * (position === PositionSide.LONG ? 1 : -1)) */
          : pos === PositionSide.LONG
          ? this.userFee
          : 1 / this.userFee)

      if (sameDirection || position.qty === 0) {
        const entryPrice =
          (position.qty * position.entryPrice + order.qty * order.price) /
          (position.qty + order.qty)
        const side = this.long ? PositionSide.LONG : PositionSide.SHORT
        position = {
          side,
          qty: position.qty + margin,
          entryPrice,
          liquidationPrice: liquidationPrice(entryPrice, side),
        }
      } else {
        const diff = position.qty - order.qty
        if (Math.abs(diff) <= Number.EPSILON) {
          position = Strategy.emptyPositon
        } else if (diff < 0) {
          const side =
            position.side === PositionSide.SHORT
              ? PositionSide.LONG
              : PositionSide.SHORT
          position = {
            qty: -diff,
            entryPrice: order.price,
            side,
            liquidationPrice: liquidationPrice(order.price, side),
          }
        } else {
          position.qty -= margin
        }
      }
      Strategy.position.set(s, position)
    }
  }

  private generateGridsOnPrice(
    minigrid: Minigrid,
    price: number,
    side: BotOrderSideEnum,
    s: string,
  ) {
    const { long, settings, symbols } = this
    const symbol = symbols.get(s)
    const botFunctions = this.botFunctions.get(s)
    if (!symbol || !botFunctions) {
      return []
    }
    const {
      settings: {
        lowPrice,
        topPrice,
        budget,
        levels,
        sellDisplacement,
        profitCurrency,
        orderFixedIn,
      },
    } = minigrid
    const gridSettings = {
      lowPrice: `${lowPrice}`,
      topPrice: `${topPrice}`,
      budget: `${budget}`,
      levels: `${levels}`,
      useStartPrice: false,
      startPrice: undefined,
      updatedBudget: true,
      forceLocal: false,
      symbol,
      _lastPrice: price,
      userFee: this.userFee,
      sellDisplacement: `${sellDisplacement}`,
      gridType: 'arithmetic' as const,
      initialPrice: long ? lowPrice : topPrice,
      futures: !!settings.futures,
      profitCurrency,
      orderFixedIn,
      coinm: !!settings.coinm,
      futuresStrategy: long
        ? FuturesStrategyEnum.long
        : FuturesStrategyEnum.short,
      useOrderInAdvance: false,
      combo: true,
      _side: side,
    }
    const grids: DCAGrid[] = botFunctions.utils
      .createGridOrders(gridSettings, true, false, !long)
      .map((g) => ({
        ...g,
        type: DCAOrderTypeEnum.grid,
        relatedTo: minigrid.dcaOrderId,
        minigridId: minigrid.id,
      }))
    return grids
  }

  private createMinigrid(
    deal: Deal,
    startOrder: FullGrid,
    lockClose: boolean,
    s: string,
    _initialPrice?: number,
  ): Minigrid | undefined {
    const symbol = this.symbols.get(s)
    if (!symbol) {
      return
    }
    const { settings, userFee, long } = this
    const price = deal.startPrice
    const startPrice = startOrder.price
    const initialPrice = _initialPrice ?? startPrice
    const baseOrder = startOrder.type === DCAOrderTypeEnum.bo
    const stepScale = parseFloat(settings.stepScale)
    const stepVal = startOrder.levelNumber
      ? stepScale ** (startOrder.levelNumber - 1)
      : 1
    const gridStep =
      (baseOrder
        ? price * (+(settings.baseStep ?? settings.step) / 100)
        : price * (+settings.step / 100)) * stepVal
    const lowPrice = this.long ? startPrice : startPrice - gridStep
    const topPrice = this.long ? startPrice + gridStep : startPrice
    const levels = Math.floor(
      +(baseOrder
        ? settings.baseGridLevels ?? settings.gridLevel ?? '1'
        : settings.gridLevel ?? '1'),
    )
    const fee = userFee
    const sellDisplacement = fee * 2 * 100
    const profitCurrency = 'quote'
    const orderFixedIn = 'base'
    let asset = {
      base: 0,
      quote: 0,
    }
    const time = startOrder.filledTime ?? +new Date()
    const budget =
      startOrder.minigridBudget ?? startOrder.qty * startOrder.price

    let minigrid: Minigrid = {
      symbol,
      initialOrders: [],
      filledOrders: [],
      activeOrders: [],
      id: this.botFunctions.values().next().value.utils.id(20),
      dealId: deal.id,
      dcaOrderId: startOrder.id,
      grids: { buy: 0, sell: 0 },
      status: 'open',
      initialBalances: asset,
      currentBalances: asset,
      initialPrice: initialPrice,
      lastPrice: initialPrice,
      lastSide: startOrder.side,
      profit: {
        total: 0,
        totalUsd: 0,
      },
      avgPrice: initialPrice,
      createTime: time,
      updateTime: time,
      assets: { used: asset, required: asset },
      settings: {
        topPrice,
        lowPrice,
        levels,
        budget,
        sellDisplacement,
        profitCurrency,
        orderFixedIn,
        step: deal.step,
      },
      transactions: {
        buy: 0,
        sell: 0,
      },
      lockClose,
    }
    const allOrders = this.generateGridsOnPrice(
      minigrid,
      _initialPrice ?? (long ? lowPrice : topPrice),
      BotOrderSideEnum.buy,
      symbol.pair,
    )
    const buys = allOrders.filter((g) => g.side === BotOrderSideEnum.buy)
    const sells = allOrders.filter((g) => g.side === BotOrderSideEnum.sell)
    const base = sells.reduce((acc, o) => acc + o.qty, 0)
    const quote = buys.reduce((acc, o) => acc + o.qty * o.price, 0)
    asset = {
      base,
      quote,
    }
    minigrid = {
      ...minigrid,
      initialOrders: allOrders,
      activeOrders: allOrders,
      grids: { buy: buys.length, sell: sells.length },
      initialBalances: asset,
      currentBalances: asset,
      assets: { used: asset, required: asset },
    }
    return minigrid
  }

  private getSlHistoryLine(
    deal: Deal,
    startTime?: number,
  ): Deal['ordersHistory'] {
    const botFunctions = this.botFunctions.get(deal.symbol.pair)
    if (!botFunctions) {
      return []
    }
    if (
      this.settings.useSl &&
      this.settings.dealCloseConditionSL === CloseConditionEnum.tp
    ) {
      if (
        !botFunctions.isTrailingSl &&
        !this.settings.useMultiSl &&
        typeof deal.slPerc !== 'undefined'
      ) {
        const price =
          deal.avgPrice *
          (1 - (deal.slPerc * -1 - this.userFee * 2) * (this.long ? 1 : -1))
        return [
          {
            qty: 0,
            price,
            side: this.long ? BotOrderSideEnum.sell : BotOrderSideEnum.buy,
            id: botFunctions.utils.id(10),
            startTime: startTime ?? deal.startTime,
            slLine: true,
            dealId: deal.id,
          },
        ]
      }
      if (
        (botFunctions.isTrailingSl || botFunctions.isTrailingTp) &&
        !this.settings.useMultiSl &&
        typeof deal.slPerc !== 'undefined'
      ) {
        const price = deal.trailingLevel
          ? deal.trailingLevel
          : deal.avgPrice *
            (1 - deal.slPerc * -1 * (this.long ? 1 : -1) - this.userFee * 2)
        return [
          {
            qty: 0,
            price,
            side: this.long ? BotOrderSideEnum.sell : BotOrderSideEnum.buy,
            id: botFunctions.utils.id(10),
            startTime: startTime ?? deal.startTime,
            slLine: true,
            dealId: deal.id,
          },
        ]
      }
      if (this.settings.useMultiSl) {
        return this.getTP(deal, undefined, undefined, true).map((o) => ({
          qty: 0,
          price: o.price,
          side: o.side,
          id: botFunctions.utils.id(10),
          startTime: startTime ?? deal.startTime,
          slLine: true,
          dealId: deal.id,
        }))
      }
    }
    return []
  }

  private getBalances(s: string): Asset[] | null | undefined {
    const symbol = this.symbols.get(s)
    if (!symbol) {
      return this.balances
    }
    if (Strategy.balance === 0) {
      return this.balances
    }

    const asset = this.futures
      ? this.coinm
        ? symbol.baseAsset.name
        : symbol.quoteAsset.name
      : this.long
      ? symbol.quoteAsset.name
      : symbol.baseAsset.name
    const balanceAsset = (this.balances ?? []).find((b) => b.asset === asset)
    const balanceItem = +(balanceAsset?.free ?? '0')
    const fullBalance = balanceItem + Strategy.totalProfit
    const free = this.futures
      ? fullBalance
      : this.long
      ? balanceItem + Strategy.totalProfit * (this.profitBase ? 0 : 1)
      : balanceItem + Strategy.totalProfit * (this.profitBase ? 1 : 0)
    const balance = {
      asset,
      free: `${free}`,
      locked: balanceAsset?.locked ?? '0',
    }
    return this.balances
      ? this.balances.filter((b) => b.asset !== asset).concat(balance)
      : [balance]
  }

  private checkCloseAfterX() {
    if (!Strategy.edge) {
      return true
    }
    if (this.settings.useCloseAfterX && this.settings.closeAfterX) {
      return (
        Strategy.deals.filter((d) => d.status === 'closed').length <=
        +this.settings.closeAfterX
      )
    }
    if (this.settings.useCloseAfterXopen && this.settings.closeAfterXopen) {
      return Strategy.deals.length <= +this.settings.closeAfterXopen
    }
    return true
  }

  public openDeal(
    price: number,
    startTime: number,
    high: number,
    low: number,
    s: string,
  ) {
    if (!this.checkCloseAfterX()) {
      return
    }
    if (!this.checkCooldownStart(startTime)) {
      return
    }
    if (!this.checkCooldownStop(startTime)) {
      return
    }
    if (!this.checkInRange(price, startTime)) {
      return
    }
    if (!this.checkMaxDeals(s)) {
      return
    }
    const symbol = this.symbols.get(s)
    const botFunctions = this.botFunctions.get(s)
    if (!symbol || !botFunctions) {
      return
    }
    Strategy.lastOpenedDeal = startTime
    let orderPrice = this.slippage
      ? price * (1 + ((this.long ? 1 : -1) * this.slippage) / 100)
      : price
    orderPrice = this.math.round(
      orderPrice > high ? high : orderPrice < low ? low : orderPrice,
      symbol.priceAssetPrecision,
    )
    let initialOrders = botFunctions
      .createOrders(
        orderPrice,
        true,
        undefined,
        undefined,
        this.getBalances(s),
        true,
      )
      .filter(
        (o) =>
          o.type !== DCAOrderTypeEnum.sl && o.type !== DCAOrderTypeEnum.grid,
      )
    const allInitialOrder = [...initialOrders]
    initialOrders = initialOrders.filter((o) =>
      this.settings.dcaCondition === DCAConditionEnum.indicators
        ? o.type !== DCAOrderTypeEnum.dca
        : true,
    )
    const hiddenDCA = [...initialOrders.filter((o) => o.grey)]
    initialOrders = [...initialOrders.filter((o) => !o.grey)]
    const id = botFunctions.utils.id(20)
    const filledOrders = initialOrders
      .filter((o) => o.type === DCAOrderTypeEnum.bo)
      .map((fo) => ({
        ...fo,
        startTime,
        filledTime: startTime,
        dealId: id,
      }))
    const baseOrder = filledOrders[0]
    this.updatePositionWithOrder(baseOrder, s)
    initialOrders = [
      ...initialOrders.filter((o) => o.type !== DCAOrderTypeEnum.tp),
    ]

    const step = baseOrder.price * (+this.settings.step / 100)
    let deal: Deal = {
      symbol,
      transactions: [],
      step,
      mingrids: [],
      id,
      initialOrders,
      filledOrders,
      hiddenOrders: [],
      activeOrders: [],
      ordersHistory: [],
      status: 'open',
      startTime,
      profit: {
        total: 0,
        totalUsd: 0,
        perc: 0,
      },
      levels: {
        all: 1,
        complete: 1,
        max: 1,
      },
      duration: 0,
      splitDuration: {
        d: '',
        h: '',
        min: '',
        s: '',
      },
      usage: {
        current: {
          base: 0,
          quote: 0,
        },
        max: {
          base: 0,
          quote: 0,
        },
      },
      initialBalance: {
        base: 0,
        quote: 0,
      },
      currentBalance: {
        base: 0,
        quote: 0,
      },
      slPerc: +(this.settings.slPerc || '0') / 100,
      avgPrice: orderPrice,
      startPrice: orderPrice,
      lastFilled: 0,
      lastPrice: orderPrice,
      volume: 0,
      equity: 0,
    }

    if (
      this.settings.useTp &&
      !botFunctions.isTrailingTp &&
      this.settings.dealCloseCondition === CloseConditionEnum.tp &&
      !this.combo
    ) {
      const tp = this.getTP(deal)
      initialOrders = [...initialOrders, ...tp]
    }

    const activeOrders: FullGrid[] = initialOrders
      .filter((o) => !filledOrders.map((fo) => fo.id).includes(o.id))
      .map((o) => ({ ...o, startTime }))

    if (this.combo) {
      const minigrid = this.createMinigrid(deal, baseOrder, false, s)
      if (minigrid) {
        deal.mingrids.push(minigrid)
        for (const o of minigrid.activeOrders) {
          activeOrders.push({ ...o, startTime })
        }
        for (const h of hiddenDCA) {
          const m = this.createMinigrid(deal, h, true, s, baseOrder.price)
          if (m) {
            deal.mingrids.push(m)
            for (const o of m.activeOrders) {
              activeOrders.push({ ...o, startTime })
              initialOrders.push(o)
              allInitialOrder.push(o)
            }
            deal.hiddenOrders.push({
              ...h,
              startTime,
              filledTime: startTime,
              dealId: id,
            })
          }
        }
      }
    }
    const initialBase = this.long
      ? 0
      : allInitialOrder
          .filter((o) => o.type !== DCAOrderTypeEnum.tp)
          .reduce((acc, o) => acc + o.qty, 0)
    const initialQuote = this.long
      ? allInitialOrder
          .filter((o) => o.type !== DCAOrderTypeEnum.tp)
          .reduce((acc, o) => acc + o.qty * o.price, 0)
      : 0
    const currentBase = filledOrders.reduce((acc, o) => acc + o.qty, 0)
    const currentQuote = filledOrders.reduce(
      (acc, o) => acc + o.qty * o.price,
      0,
    )
    deal = {
      ...deal,
      activeOrders,
      ordersHistory: [...activeOrders].map((o) => ({ ...o, dealId: id })),
      initialBalance: {
        base: initialBase,
        quote: initialQuote,
      },
      currentBalance: {
        base: !this.long ? initialBase - currentBase : currentBase,
        quote: this.long ? initialQuote - currentQuote : currentQuote,
      },
      levels: {
        all: this.settings.useDca
          ? this.settings.dcaCondition === DCAConditionEnum.indicators
            ? this.settings.indicators.filter(
                (si) => si.indicatorAction === IndicatorAction.startDca,
              ).length + 1
            : this.settings.dcaCondition === DCAConditionEnum.custom
            ? (this.settings.dcaCustom ?? []).length + 1
            : initialOrders.filter((o) => o.type === DCAOrderTypeEnum.dca)
                .length + 1
          : 1,
        complete: 1,
        max: 1,
      },
      usage: {
        current: {
          base: this.futures
            ? this.coinm
              ? filledOrders.reduce((acc, fo) => (acc += fo.qty), 0)
              : 0
            : this.long
            ? 0
            : filledOrders.reduce((acc, fo) => (acc += fo.qty), 0),
          quote: this.futures
            ? this.coinm
              ? 0
              : filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
            : this.long
            ? filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
            : 0,
        },
        max: {
          base: this.futures
            ? this.coinm
              ? allInitialOrder
                  .filter((io) => io.type !== DCAOrderTypeEnum.tp)
                  .reduce((acc, io) => (acc += io.qty), 0)
              : 0
            : this.long
            ? 0
            : allInitialOrder
                .filter((io) => io.type !== DCAOrderTypeEnum.tp)
                .reduce((acc, io) => (acc += io.qty), 0),
          quote: this.futures
            ? this.coinm
              ? 0
              : allInitialOrder
                  .filter((io) => io.type !== DCAOrderTypeEnum.tp)
                  .reduce((acc, io) => (acc += io.qty * io.price), 0)
            : this.long
            ? allInitialOrder
                .filter((io) => io.type !== DCAOrderTypeEnum.tp)
                .reduce((acc, io) => (acc += io.qty * io.price), 0)
            : 0,
        },
      },
    }
    deal = this.updateDealVolume(deal)

    if (botFunctions.isTrailingSl || botFunctions.isTrailingTp) {
      deal = this.checkTrailing(deal, price, startTime)
    } else {
      if (!this.combo) {
        for (const slLine of this.getSlHistoryLine(deal)) {
          deal.ordersHistory.push(slLine)
        }
      }
    }
    if (this.profitBase && deal.usage.current.base > Strategy.maxUsage.deal) {
      Strategy.maxUsage.deal = deal.usage.current.base
    }
    if (!this.profitBase && deal.usage.current.quote > Strategy.maxUsage.deal) {
      Strategy.maxUsage.deal = deal.usage.current.quote
    }
    Strategy.deals.push(deal)

    if (Strategy.balance === 0) {
      const usdRateQuote = this.usdRateQuote.get(s) ?? 1
      const usdRate = this.usdRate.get(s) ?? 1

      Strategy.balance = this.futures
        ? this.coinm
          ? deal.usage.max.base
          : deal.usage.max.quote
        : this.long
        ? deal.usage.max.quote * (this.profitBase ? 1 / deal.startPrice : 1)
        : deal.usage.max.base * (this.profitBase ? 1 : deal.startPrice)
      const { maxNumberOfOpenDeals, maxDealsPerPair, useMulti } = this.settings
      if (
        maxNumberOfOpenDeals &&
        maxNumberOfOpenDeals !== '' &&
        !isNaN(+maxNumberOfOpenDeals) &&
        +maxNumberOfOpenDeals > 0 &&
        (Strategy.multi || (!Strategy.multi && !useMulti))
      ) {
        Strategy.balance *= +maxNumberOfOpenDeals
      }
      if (
        maxDealsPerPair &&
        maxDealsPerPair !== '' &&
        !isNaN(+maxDealsPerPair) &&
        +maxDealsPerPair > 0 &&
        !Strategy.multi &&
        useMulti
      ) {
        Strategy.balance *= +maxDealsPerPair
      }
      Strategy.balanceUsd =
        Strategy.balance *
        (this.profitBase ? deal.startPrice : 1) *
        (this.profitBase ? usdRateQuote : usdRate)
      Strategy.initialBalance = Strategy.balance
      Strategy.initialBalanceUsd = Strategy.balanceUsd
      Strategy.initialBalanceSymbol = s
    }
  }

  /* private getUsdRate(symbol: string, price: number, type?: 'base' | 'quote') {
    const s = this.symbols.get(symbol)
    if (!s) {
      return 1
    }
    return findUSDRate(
      type === 'base'
        ? s.baseAsset.name
        : type === 'quote'
        ? s.quoteAsset.name
        : this.profitBase
        ? s.baseAsset.name
        : s.quoteAsset.name,
      [...this.prices.filter((p) => p.symbol !== symbol), { symbol, price }],
    )
  } */

  private updateDealVolume(deal: Deal /* , bar: FullBar */) {
    const usdRateQuote =
      /* this.getUsdRate(deal.symbol.pair, bar.close, 'quote') */ this.usdRateQuote.get(
        deal.symbol.pair,
      ) ?? 1
    const usdRate =
      /* this.getUsdRate(deal.symbol.pair, bar.close) */ this.usdRate.get(
        deal.symbol.pair,
      ) ?? 1
    const usageBase = this.combo ? deal.usage.max.base : deal.usage.current.base
    const usageQuote = this.combo
      ? deal.usage.max.quote
      : deal.usage.current.quote
    deal.volume = this.math.round(
      (this.futures
        ? this.coinm
          ? usageBase
          : usageQuote
        : this.long
        ? usageQuote * (this.profitBase ? 1 / deal.avgPrice : 1)
        : usageBase * (this.profitBase ? 1 : deal.avgPrice)) *
        (this.profitBase ? deal.avgPrice : 1) *
        (this.profitBase ? usdRateQuote : usdRate),
      3,
    )
    return deal
  }

  private updateDealEquity(deal: Deal) {
    if (!deal.closedTime) {
      return deal
    }
    const previousValues = Strategy.deals
      .filter(
        (d) =>
          d.closedTime &&
          d.closedTime <= (deal.closedTime ?? deal.startTime) &&
          deal.id !== d.id,
      )
      .reduce((acc, v) => acc + v.profit.totalUsd, 0)
    deal.equity = this.math.round(
      deal.profit.totalUsd +
        previousValues +
        Strategy.initialBalanceUsd / this.leverage,
      3,
    )
    return deal
  }

  private filterTP(d: Deal, b: FullBar): { deal: Deal; order?: FullGrid } {
    if (this.combo) {
      return { deal: d }
    }
    const botFunctions = this.botFunctions.get(b.symbol)
    const symbol = this.symbols.get(b.symbol)
    if (!botFunctions || !symbol) {
      return { deal: d }
    }
    if (botFunctions.isTrailingTp) {
      return { deal: d }
    }
    const filledTp = d.activeOrders
      .filter((o) => o.type === DCAOrderTypeEnum.tp)
      .filter(this.filterFn.filledTp(b))
    for (const tp of filledTp) {
      this.updatePositionWithOrder(tp, b.symbol)
    }
    if (
      this.settings.useMultiTp &&
      this.settings.multiTp &&
      this.settings.multiTp.length &&
      filledTp.length
    ) {
      const lastTp = filledTp.sort((a, bb) =>
        this.long ? bb.price - a.price : a.price - bb.price,
      )[0]
      d.filledOrders = [
        ...d.filledOrders,
        ...filledTp.map((ftp) => ({ ...ftp, filledTime: b.time })),
      ].map((o) => ({ ...o, dealId: d.id }))
      d.activeOrders = [
        ...d.activeOrders.filter(
          (ao) =>
            !filledTp.map((ftp) => ftp.id).includes(ao.id) &&
            ao.type &&
            ![DCAOrderTypeEnum.dca].includes(ao.type),
        ),
      ]
      for (const tp of filledTp) {
        if (
          tp.tpSlTarget &&
          !(d.tpSlTargetFilled ?? []).includes(tp.tpSlTarget)
        ) {
          d.tpSlTargetFilled = [...(d.tpSlTargetFilled ?? []), tp.tpSlTarget]
        }
      }

      const newTpOrders = this.getTP(d)
      d.activeOrders = [
        ...d.activeOrders.filter(this.filterTpOrders()),
        ...newTpOrders,
      ]
      d.ordersHistory = [
        ...d.ordersHistory.map((oh) => {
          if (oh.filledTime) {
            return oh
          }
          for (const ftp of filledTp) {
            if (ftp.price === oh.price && ftp.type === oh.type) {
              oh.filledTime = b.time
            }
          }
          return oh
        }),
      ]
      const filledBase = filledTp.reduce((acc, o) => acc + o.qty, 0)
      const filledQuote = filledTp.reduce((acc, o) => acc + o.qty * o.price, 0)
      d.currentBalance.base = this.long
        ? d.currentBalance.base - filledBase
        : d.currentBalance.base + filledBase
      d.currentBalance.quote = this.long
        ? d.currentBalance.quote + filledQuote
        : d.currentBalance.quote - filledQuote

      const allFilled = this.long
        ? this.math.lte(
            d.currentBalance.base * d.avgPrice,
            symbol.quoteAsset.minAmount,
          ) && this.math.lte(d.currentBalance.base, symbol.baseAsset.minAmount)
        : this.math.lte(d.currentBalance.quote, symbol.quoteAsset.minAmount) &&
          this.math.lte(
            d.currentBalance.quote / d.avgPrice,
            symbol.baseAsset.minAmount,
          )
      /* const profit = this.getProfit(d)
      if (profit) {
        d.profit = profit
      } */

      return { deal: d, order: allFilled ? lastTp : undefined }
    }

    return { deal: d, order: filledTp[0] }
  }

  private filterTpOrders() {
    return (ao: FullGrid) =>
      ao.type !== DCAOrderTypeEnum.tp && ao.type !== DCAOrderTypeEnum.sl
  }

  private updateDealBalances(d: Deal) {
    const filledBase = d.filledOrders.reduce(
      (acc, v) => acc + v.qty * (v.side === BotOrderSideEnum.buy ? 1 : -1),
      0,
    )
    const filledQuote = d.filledOrders.reduce(
      (acc, v) =>
        acc + v.qty * v.price * (v.side === BotOrderSideEnum.buy ? -1 : 1),
      0,
    )
    d.currentBalance.quote = d.initialBalance.quote + filledQuote
    d.currentBalance.base = d.initialBalance.base + filledBase
    return d
  }

  private updateDealUsage(d: Deal) {
    const usage = this.getUsage(d)
    if (
      (!this.long || this.coinm) &&
      usage.current.base > Strategy.maxUsage.deal
    ) {
      Strategy.maxUsage.deal = usage.current.base
    }
    if (
      (this.long || (this.futures && !this.coinm)) &&
      usage.current.quote > Strategy.maxUsage.deal
    ) {
      Strategy.maxUsage.deal = usage.current.quote
    }
    d.usage = { ...d.usage, ...usage }
    return d
  }

  private avgPrice(deal?: Deal, minigrid?: Minigrid) {
    const minigrids =
      deal?.mingrids.filter((m) => m.status === 'open').map((m) => m.id) ?? []
    const filledDealOrder = (
      deal ? deal.filledOrders : minigrid?.filledOrders ?? []
    )
      .filter(
        (o) =>
          o.side === (this.long ? BotOrderSideEnum.buy : BotOrderSideEnum.sell),
      )
      .filter((o) =>
        deal && this.combo
          ? !o.minigridId || minigrids.includes(o.minigridId)
          : true,
      )
    let base = filledDealOrder.reduce((acc, v) => acc + v.qty, 0)
    let quote = filledDealOrder.reduce((acc, v) => acc + v.qty * v.price, 0)
    if (minigrid) {
      base += this.long
        ? minigrid.initialBalances.base
        : minigrid.initialBalances.quote / minigrid.initialPrice
      quote += this.long
        ? minigrid.initialPrice * minigrid.initialBalances.base
        : minigrid.initialBalances.quote
    }
    return quote / base
  }

  private replaceAvgPriceHistoryLine(d: Deal, price: number, time: number) {
    d.ordersHistory = d.ordersHistory.map((oh) => {
      if (!oh.filledTime && oh.avgLine) {
        oh.filledTime = time
      }
      return oh
    })
    const botFunctions = this.botFunctions.get(d.symbol.pair)
    d.ordersHistory.push({
      qty: 0,
      price,
      side: BotOrderSideEnum.buy,
      id: botFunctions?.utils.id(10) ?? '',
      startTime: time,
      avgLine: true,
      dealId: d.id,
    })
    return d
  }

  private updateDealAvgPrice(d: Deal, time: number) {
    const avgPrice = this.avgPrice(d)
    if (avgPrice !== d.avgPrice) {
      d.avgPrice = avgPrice
      d = this.replaceAvgPriceHistoryLine(d, avgPrice, time)
    }
    return d
  }

  private updateDealDuration(d: Deal, b: BarTV) {
    d.duration = b.time - d.startTime
    d.splitDuration = friendlyTime(d.duration)
    return d
  }

  get futuresStrategy(): FuturesStrategyEnum | undefined {
    return this.futures
      ? this.long
        ? FuturesStrategyEnum.long
        : FuturesStrategyEnum.short
      : undefined
  }
  private createTransaction(
    o: FullGrid,
    minigrid: Minigrid,
  ): {
    profitBase: number
    profitQuote: number
    profitUsdt: number
  } {
    const symbol = this.symbols.get(minigrid.symbol.pair)
    const botFunctions = this.botFunctions.get(minigrid.symbol.pair)
    if (!symbol || !botFunctions) {
      return { profitBase: 0, profitQuote: 0, profitUsdt: 0 }
    }
    const { userFee } = this
    const {
      settings: {
        lowPrice,
        topPrice,
        sellDisplacement,
        levels,
        profitCurrency,
      },
      initialPrice,
      avgPrice,
      filledOrders,
    } = minigrid
    const prices = botFunctions.utils.getPrices({
      lowPrice: `${lowPrice}`,
      topPrice: `${topPrice}`,
      sellDisplacement: `${sellDisplacement}`,
      gridType: 'arithmetic',
      levels: `${levels}`,
      symbol,
    })
    prices[prices.length - 1].buy = this.math.round(
      topPrice,
      symbol.priceAssetPrecision,
    )
    const grids =
      this.generateGridsOnPrice(
        minigrid,
        topPrice * 2,
        BotOrderSideEnum.buy,
        symbol.pair,
      ) ?? []
    const _profitBase = profitCurrency === 'base'
    const { qty, price, side, filledTime, id } = o
    let comBase = side === BotOrderSideEnum.buy ? qty * userFee : 0
    let comQuote = side === BotOrderSideEnum.sell ? qty * price * userFee : 0
    let profitQuote = 0
    let matchedPrice = 0
    let matchQty = 0
    let profitBase = 0
    let matchedId = ''
    let profitUsdt = 0
    let amountBaseBuy = side === BotOrderSideEnum.sell ? 0 : qty
    let amountQuoteBuy = side === BotOrderSideEnum.sell ? 0 : qty * price
    let amountBaseSell = side === BotOrderSideEnum.buy ? 0 : qty
    let amountQuoteSell = side === BotOrderSideEnum.buy ? 0 : qty * price
    if (!this.futures) {
      if (side === BotOrderSideEnum.sell && _profitBase) {
        comBase = comQuote / price
      }
      if (side === BotOrderSideEnum.buy && !_profitBase) {
        comQuote = comBase * price
      }
      let index = prices.findIndex(
        (p) => (side === BotOrderSideEnum.sell ? p.sell : p.buy) === price,
      )
      if (index === -1) {
        index = prices.findIndex(
          (p) => (side === BotOrderSideEnum.sell ? p.buy : p.sell) === price,
        )
      }
      const match = filledOrders.find(
        (g) =>
          g.price ===
            (side === BotOrderSideEnum.sell
              ? prices[index - 1]?.buy || 0
              : prices[index + 1]?.sell || 0) &&
          g.side !== o.side &&
          (g.filledTime ?? 0) <= (filledTime ?? 0) &&
          !this.usedOrderId.has(g.id),
      )
      const needMatch = this.long
        ? side === BotOrderSideEnum.buy ||
          (initialPrice &&
            side === BotOrderSideEnum.sell &&
            price <= initialPrice)
        : side === BotOrderSideEnum.sell ||
          (initialPrice &&
            side === BotOrderSideEnum.buy &&
            price >= initialPrice)
      if (!needMatch && !match) {
        this.usedOrderId.add(id)
        matchedId = 'initial price'
        matchQty = _profitBase ? (price * qty) / (initialPrice ?? price) : qty
        matchedPrice = initialPrice ?? price
      } else if (match) {
        matchedId = match.id
        matchQty = match.qty
        matchedPrice = match.price
        this.usedOrderId.add(matchedId)
        this.usedOrderId.add(id)
      }
      if (matchedPrice !== 0) {
        const pnlBase =
          side === BotOrderSideEnum.sell ? matchQty - qty : qty - matchQty
        const pnlQuote =
          side === BotOrderSideEnum.sell
            ? qty * price - matchQty * matchedPrice
            : matchQty * matchedPrice - qty * price
        profitBase +=
          pnlBase +
          pnlQuote / (side === BotOrderSideEnum.buy ? price : matchedPrice)
        profitQuote +=
          pnlQuote +
          pnlBase * (side === BotOrderSideEnum.buy ? price : matchedPrice)
        if (side === 'BUY') {
          amountBaseSell = matchQty
          amountQuoteSell = matchQty * matchedPrice
        }
        if (side === 'SELL') {
          amountBaseBuy = matchQty
          amountQuoteBuy = matchQty * matchedPrice
        }
      }
    } else {
      if (!_profitBase && !this.futures) {
        if (side === BotOrderSideEnum.buy) {
          comQuote = comBase * price
        }
        if (side === BotOrderSideEnum.sell) {
          let index = prices.findIndex((p) => p.sell === price)
          if (index === -1) {
            index = prices.findIndex((p) => p.buy === price)
          }
          const buyMatch = (grids ?? []).find(
            (g) =>
              index !== -1 &&
              g.price === prices[index - 1].buy &&
              g.side === BotOrderSideEnum.buy,
          )
          if (buyMatch) {
            profitBase = buyMatch.qty - qty
            profitQuote =
              qty * price - buyMatch.qty * buyMatch.price + profitBase * price
            matchedPrice = buyMatch.price
            amountBaseBuy = buyMatch.qty
            amountQuoteBuy = buyMatch.qty * buyMatch.price
          }
        }
      }
      if (_profitBase || this.futures) {
        if (o.side === BotOrderSideEnum.sell) {
          comBase = comQuote / price
        }
        if (!this.usedOrderId.has(id)) {
          if (this.futuresStrategy !== FuturesStrategyEnum.neutral) {
            const withMatch =
              (this.futuresStrategy === FuturesStrategyEnum.long &&
                o.side === BotOrderSideEnum.sell) ||
              (this.futuresStrategy === FuturesStrategyEnum.short &&
                o.side === BotOrderSideEnum.buy)
            this.usedOrderId.add(id)
            if (withMatch) {
              matchedId = 'position price'
              matchQty = _profitBase ? (price * qty) / (avgPrice || price) : qty
              matchedPrice = avgPrice || price
              const pnlBase =
                o.side === BotOrderSideEnum.sell
                  ? matchQty - qty
                  : qty - matchQty
              const pnlQuote =
                o.side === BotOrderSideEnum.sell
                  ? qty * price - matchQty * matchedPrice
                  : matchQty * matchedPrice - qty * price
              profitBase +=
                pnlBase +
                pnlQuote /
                  (o.side === BotOrderSideEnum.buy ? price : matchedPrice)
              profitQuote +=
                pnlQuote +
                pnlBase *
                  (o.side === BotOrderSideEnum.buy ? price : matchedPrice)
              if (side === 'BUY') {
                amountBaseSell = matchQty
                amountQuoteSell = matchQty * matchedPrice
              }
              if (side === 'SELL') {
                amountBaseBuy = matchQty
                amountQuoteBuy = matchQty * matchedPrice
              }
            }
          } else {
            let index = prices.findIndex(
              (p) =>
                (o.side === BotOrderSideEnum.sell ? p.sell : p.buy) === price,
            )
            if (index === -1) {
              index = prices.findIndex(
                (p) =>
                  (o.side === BotOrderSideEnum.sell ? p.buy : p.sell) === price,
              )
            }

            const match = filledOrders.find(
              (g) =>
                g.price ===
                  (o.side === BotOrderSideEnum.sell
                    ? prices[index - 1]?.buy || 0
                    : prices[index + 1]?.sell || 0) &&
                g.side !== side &&
                (g.filledTime ?? 0) < (filledTime ?? 0) &&
                !this.usedOrderId.has(g.id),
            )
            if (match) {
              matchedId = match.id
              this.usedOrderId.add(matchedId)
              this.usedOrderId.add(id)
              matchQty = match.qty
              matchedPrice = match.price
              const pnlBase =
                side === BotOrderSideEnum.sell ? matchQty - qty : qty - matchQty
              const pnlQuote =
                side === BotOrderSideEnum.sell
                  ? qty * price - matchQty * matchedPrice
                  : matchQty * matchedPrice - qty * price
              profitBase +=
                pnlBase +
                pnlQuote /
                  (side === BotOrderSideEnum.buy ? price : matchedPrice)
              profitQuote +=
                pnlQuote +
                pnlBase * (side === BotOrderSideEnum.buy ? price : matchedPrice)
              if (side === 'BUY') {
                amountBaseSell = matchQty
                amountQuoteSell = matchQty * matchedPrice
              }
              if (side === 'SELL') {
                amountBaseBuy = matchQty
                amountQuoteBuy = matchQty * matchedPrice
              }
            }
          }
        }
      }
    }
    const totalQuote =
      profitQuote - (comQuote === 0 ? comBase * price : comQuote)
    const usdRate = this.usdRateQuote.get(minigrid.symbol.pair) ?? 1
    const precisionBase = this.precisionBase.get(minigrid.symbol.pair) ?? 8
    const precisionQuote = this.precisionQuote.get(minigrid.symbol.pair) ?? 8
    const precision = this.precision.get(minigrid.symbol.pair) ?? 8
    profitUsdt = totalQuote * usdRate
    const transaction: BacktestingTransaction = {
      _id: v4(),
      updateTime: filledTime ?? 0,
      side,
      amountBaseBuy: this.math.convertFromExponential(
        this.math.round(amountBaseBuy, precisionBase),
        precisionBase,
      ),
      amountQuoteBuy: this.math.convertFromExponential(
        this.math.round(amountQuoteBuy, precisionQuote),
        precisionQuote,
      ),
      amountBaseSell: this.math.convertFromExponential(
        this.math.round(amountBaseSell, precisionBase),
        precisionBase,
      ),
      amountQuoteSell: this.math.convertFromExponential(
        this.math.round(amountQuoteSell, precisionQuote),
        precisionQuote,
      ),
      priceSell: this.math.convertFromExponential(
        this.math.round(
          side === BotOrderSideEnum.sell ? price : matchedPrice,
          symbol.priceAssetPrecision,
        ),
        symbol.priceAssetPrecision,
      ),
      priceBuy: this.math.convertFromExponential(
        this.math.round(
          side === BotOrderSideEnum.buy ? price : matchedPrice,
          symbol.priceAssetPrecision,
        ),
        symbol.priceAssetPrecision,
      ),
      profit: this.math.convertFromExponential(
        this.math.round(
          this.profitBase ? profitBase - comBase : profitQuote - comQuote,
          precision + 3,
        ),
        precision + 3,
      ),
      profitUsd: this.math.round(profitUsdt, 2),
      baseAsset: symbol.baseAsset.name,
      quoteAsset: symbol.quoteAsset.name,
      profitAsset: this.futures
        ? this.coinm
          ? symbol.baseAsset.name
          : symbol.quoteAsset.name
        : this.profitBase
        ? symbol.baseAsset.name
        : symbol.quoteAsset.name,
      index: Strategy.transactionIndex,
      idBuy: o.side === BotOrderSideEnum.buy ? o.id : matchedId,
      idSell: o.side === BotOrderSideEnum.buy ? matchedId : o.id,
      executor: o.id,
      cummulativeProfitBase: 0,
      cummulativeProfitQuote: 0,
      cummulativeProfitUsdt: 0,
      freeProfit: 0,
      freeProfitUsd: 0,
      amountFreeBaseBuy: 0,
      amountFreeBaseSell: 0,
      amountFreeQuoteBuy: 0,
      amountFreeQuoteSell: 0,
    }
    Strategy.transactionIndex++
    Strategy.deals = Strategy.deals.map((d) => {
      if (d.id === minigrid.dealId) {
        d.transactions.push(transaction)
      }
      return d
    })
    return {
      profitBase: profitBase - comBase,
      profitQuote: profitQuote - comQuote,
      profitUsdt,
    }
  }

  private updateDeal(d: Deal, b: BarTV) {
    d = this.updateDealBalances(d)
    d = this.updateDealUsage(d)
    d = this.updateDealAvgPrice(d, b.time)
    d = this.updateDealDuration(d, b)
    d = this.updateDealVolume(d)
    return d
  }

  private processGridOrders(d: Deal, b: FullBar) {
    if (!this.combo) {
      return d
    }
    for (const m of d.mingrids.filter(
      (mg) => mg.status === 'open' && mg.symbol.pair === b.symbol,
    )) {
      const botFunctions = this.botFunctions.get(m.symbol.pair)
      let grids = m.activeOrders.filter((g) => g.type === DCAOrderTypeEnum.grid)
      let total = 0
      let totalUsd = 0
      const filledBuy = grids
        .filter((g) => g.side === BotOrderSideEnum.buy && g.price >= b.low)
        .sort((a, B) => B.price - a.price)
      for (const o of filledBuy) {
        o.filledTime = b.time
        m.filledOrders.push(o)
        d.filledOrders.push({ ...o, dealId: d.id })
        this.updatePositionWithOrder(o, b.symbol)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
      }
      const lastFilledBuy = filledBuy[filledBuy.length - 1]
      if (lastFilledBuy) {
        const lastPrice = lastFilledBuy.price
        grids = this.generateGridsOnPrice(
          m,
          lastPrice,
          BotOrderSideEnum.buy,
          m.symbol.pair,
        )
        m.lastPrice = lastFilledBuy.price
        m.lastSide = lastFilledBuy.side
      }
      const filledSell = grids
        .filter((g) => g.side === BotOrderSideEnum.sell && g.price <= b.high)
        .sort((a, B) => a.price - B.price)
      for (const o of filledSell) {
        o.filledTime = b.time
        m.filledOrders.push(o)
        d.filledOrders.push({ ...o, dealId: d.id })
        this.updatePositionWithOrder(o, b.symbol)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
      }
      if (total !== 0) {
        Strategy.profits.push({ total, totalUsd, time: b.time })
      }
      const lastFilledSell = filledSell[filledSell.length - 1]
      if (lastFilledSell) {
        const lastPrice = lastFilledSell.price
        grids = this.generateGridsOnPrice(
          m,
          lastPrice,
          BotOrderSideEnum.sell,
          m.symbol.pair,
        )
        m.lastPrice = lastFilledSell.price
        m.lastSide = lastFilledSell.side
      }
      if (filledBuy.length || filledSell.length) {
        m.activeOrders = grids
        d.ordersHistory = d.ordersHistory.map((o) => {
          if (
            o.minigridId === m.id &&
            o.type === DCAOrderTypeEnum.grid &&
            !o.filledTime
          ) {
            if (
              !grids.find(
                (g) =>
                  g.price === o.price && g.side === o.side && g.qty === o.qty,
              )
            ) {
              o.filledTime = b.time
            }
          }
          return o
        })
        d.ordersHistory = [
          ...d.ordersHistory,
          ...m.activeOrders
            .filter(
              (g) =>
                !d.ordersHistory.find(
                  (oh) =>
                    g.type === DCAOrderTypeEnum.grid &&
                    !oh.filledTime &&
                    g.price === oh.price &&
                    g.side === oh.side &&
                    g.qty === oh.qty,
                ),
            )
            .map((o) => ({ ...o, startTime: b.time, dealId: d.id })),
        ]
        m.transactions.buy += filledBuy.length
        m.transactions.sell += filledSell.length
        const buys = grids.filter((g) => g.side === BotOrderSideEnum.buy)
        const sells = grids.filter((g) => g.side === BotOrderSideEnum.sell)
        m.grids.buy = buys.length
        m.grids.sell = sells.length
        const balance = {
          base: sells.reduce((acc, s) => acc + s.qty, 0),
          quote: buys.reduce((acc, B) => acc + B.qty * B.price, 0),
        }
        m.currentBalances = balance
        m.assets = {
          used: balance,
          required: balance,
        }
        m.profit.total += total
        m.profit.totalUsd += totalUsd
        const closed =
          !m.lockClose && (this.long ? m.grids.sell === 0 : m.grids.buy === 0)
        if (closed) {
          m.status = 'close'
          m.activeOrders = []
          d.lastFilled -= 1
          d.levels.complete = Math.max(d.lastFilled, 0)
          d.levels.max = Math.max(d.lastFilled, d.levels.max)
          m.closeTime = b.time
        }

        d.profit.total += total
        d.profit.totalUsd += totalUsd
        d.mingrids = [...d.mingrids.filter((mm) => mm.id !== m.id), m]
        d.activeOrders = [
          ...d.activeOrders.filter((o) => o.minigridId !== m.id),
          ...m.activeOrders,
        ]
        d = this.updateDeal(d, b)
        if (closed) {
          const order =
            d.filledOrders.find((o) => o.id === m.dcaOrderId) ??
            d.hiddenOrders.find((o) => o.id === m.dcaOrderId)
          if (order?.type === DCAOrderTypeEnum.bo) {
            return this.closeDeal(
              d,
              b,
              this.getTP(
                d,
                lastFilledSell?.price ?? lastFilledBuy?.price ?? b.close,
              )[0],
            )
          }
          if (order) {
            d.activeOrders.push({
              ...order,
              filledTime: undefined,
              id: botFunctions?.utils.id(20) ?? '',
            })
            d.ordersHistory = d.ordersHistory.map((o) =>
              o.minigridId === m.id && !o.filledTime
                ? { ...o, filledTime: b.time }
                : { ...o },
            )
            d.ordersHistory.push({
              ...order,
              startTime: b.time,
              filledTime: undefined,
              dealId: d.id,
            })
          }
        }
      }
    }
    return d
  }

  private replaceSlHistoryLine(d: Deal, slLines: FullGrid[], time: number) {
    const localSlLines = d.ordersHistory
      .filter(
        (o) =>
          o.slLine &&
          !o.filledTime &&
          !slLines.find((sl) => sl.price === o.price),
      )
      .map((l) => {
        l.filledTime = time
        return l
      })
    d.ordersHistory = [
      ...d.ordersHistory.filter(
        (o) => !localSlLines.map((l) => l.id).includes(o.id),
      ),
      ...slLines,
      ...localSlLines,
    ].map((o) => ({ ...o, dealId: d.id }))
    return d
  }

  addDCAOrder(index: number, price: number, time: number, symbol: string) {
    for (const d of Strategy.deals.filter(
      (dd) =>
        dd.status === 'open' &&
        dd.lastFilled + 1 === index + 1 &&
        dd.symbol.pair === symbol,
    )) {
      if (this.settings.dcaCondition === DCAConditionEnum.indicators) {
        const ind = this.settings.indicators.filter(
          (i) => i.indicatorAction === IndicatorAction.startDca,
        )[index]
        if (ind) {
          const botFunctions = this.botFunctions.get(d.symbol.pair)
          if (!botFunctions) {
            continue
          }
          const { minPercFromLast } = ind
          if (minPercFromLast && !isNaN(+minPercFromLast)) {
            const diff = this.long ? d.lastPrice - price : price - d.lastPrice
            const absDiff = diff / d.lastPrice

            if (absDiff >= +minPercFromLast / 100) {
              const orders = botFunctions.createOrders(
                d.startPrice,
                true,
                undefined,
                [],
                this.getBalances(d.symbol.pair),
                true,
              )
              const dcaOrder = orders.find((o) => o.levelNumber === index + 1)
              if (dcaOrder) {
                d.activeOrders.push({ ...dcaOrder, startTime: time, price })
                this.processDCAOrders(d, {
                  open: price,
                  close: price,
                  high: price,
                  low: price,
                  time,
                  symbol,
                })
              }
            }
          }
        }
      }
    }
  }

  private processDCAOrders(d: Deal, b: FullBar) {
    const filledDCA = d.activeOrders
      .filter(
        (o) =>
          o.type === DCAOrderTypeEnum.dca || o.type === DCAOrderTypeEnum.bo,
      )
      .filter(this.filterFn.filledOrders(b))
      .map((o) => ({ ...o, filledTime: b.time }))
    if (filledDCA.length > 0) {
      for (const o of filledDCA.sort((a, B) =>
        this.long ? B.price - a.price : a.price - B.price,
      )) {
        d.lastFilled = o.levelNumber ?? d.lastFilled
        if (this.combo) {
          const m = this.createMinigrid(d, o, false, d.symbol.pair)
          if (m) {
            d.mingrids.push(m)
            for (const ao of m.activeOrders) {
              d.activeOrders.push({ ...ao, startTime: b.time })
            }
          }
        }
        this.updatePositionWithOrder(o, b.symbol)
        d.lastPrice = o.price
      }
      d.filledOrders = [...d.filledOrders, ...filledDCA].map((o) => ({
        ...o,
        dealId: d.id,
      }))
      d = this.updateDeal(d, b)
      if (
        this.settings.useTp &&
        this.settings.dealCloseCondition === CloseConditionEnum.tp &&
        !this.combo
      ) {
        const tpOrdersCurrent = this.getTP(d)
        d.activeOrders = [
          ...d.activeOrders.filter(this.filterTpOrders()),
          ...tpOrdersCurrent,
        ]
      }
      d.levels.max = Math.max(d.lastFilled, d.levels.max)
      d.levels.complete = this.combo
        ? Math.max(d.lastFilled, 0)
        : d.levels.complete + filledDCA.length
      d.activeOrders = d.activeOrders.filter(
        (o) => !d.filledOrders.map((fo) => fo.id).includes(o.id),
      )
      d.ordersHistory = d.ordersHistory.map((o) => {
        if (
          (o.type === DCAOrderTypeEnum.dca ||
            o.type === DCAOrderTypeEnum.bo ||
            o.type === DCAOrderTypeEnum.tp) &&
          !o.filledTime
        ) {
          if (
            !d.activeOrders.find(
              (g) =>
                g.price === o.price && g.side === o.side && g.qty === o.qty,
            )
          ) {
            o.filledTime = b.time
          }
        }
        return o
      })
      d.ordersHistory = [
        ...d.ordersHistory,
        ...d.activeOrders
          .filter(
            (g) =>
              !d.ordersHistory.find(
                (oh) =>
                  (oh.type === DCAOrderTypeEnum.dca ||
                    oh.type === DCAOrderTypeEnum.bo ||
                    oh.type === DCAOrderTypeEnum.tp ||
                    oh.type === DCAOrderTypeEnum.grid) &&
                  !oh.filledTime &&
                  g.price === oh.price &&
                  g.side === oh.side &&
                  g.qty === oh.qty,
              ),
          )
          .map((o) => ({ ...o, startTime: b.time })),
      ].map((o) => ({ ...o, dealId: d.id }))
      if (!this.combo) {
        const slLine = this.getSlHistoryLine(d, b.time)
        d = this.replaceSlHistoryLine(d, slLine, b.time)
      }
    }
    return d
  }

  private getSLOrder(d: Deal, b: FullBar): { deal: Deal; order?: FullGrid } {
    if (
      this.settings.dealCloseConditionSL !== CloseConditionEnum.tp &&
      !this.combo &&
      !this.settings.moveSLForAll
    ) {
      return { deal: d }
    }
    const symbol = this.symbols.get(d.symbol.pair)
    const botFunctions = this.botFunctions.get(d.symbol.pair)
    if (!symbol || !botFunctions) {
      return { deal: d }
    }
    let close = false
    let closePrice = 0
    if (
      this.settings.useMultiSl &&
      this.settings.multiSl &&
      this.settings.multiSl.length > 0 &&
      !this.combo
    ) {
      const slOrders = this.getTP(d, undefined, false, true)
      const filledSl = slOrders.filter((o) =>
        this.long ? o.price >= b.low : o.price <= b.high,
      )
      if (slOrders.length && filledSl.length) {
        d.ordersHistory = d.ordersHistory.map((o) => {
          if (o.slLine && filledSl.find((fsl) => fsl.price === o.price)) {
            o.filledTime = b.time
          }
          return o
        })
        const lastSl = filledSl.sort((a, bb) =>
          this.long ? a.price - bb.price : bb.price - a.price,
        )[0]
        d.filledOrders = [
          ...d.filledOrders,
          ...filledSl.map((fsl) => ({ ...fsl, filledTime: b.time })),
        ].map((o) => ({ ...o, dealId: d.id }))
        const filledBase = filledSl.reduce((acc, o) => acc + o.qty, 0)
        const filledQuote = filledSl.reduce(
          (acc, o) => acc + o.qty * o.price,
          0,
        )
        d.activeOrders = [
          ...d.activeOrders.filter(
            (deal) => deal.type && ![DCAOrderTypeEnum.dca].includes(deal.type),
          ),
        ]
        for (const sl of filledSl) {
          if (
            sl.tpSlTarget &&
            !(d.tpSlTargetFilled ?? []).includes(sl.tpSlTarget)
          ) {
            this.updatePositionWithOrder(sl, b.symbol)
            d.tpSlTargetFilled = [...(d.tpSlTargetFilled ?? []), sl.tpSlTarget]
          }
        }
        const newTpOrders = this.getTP(d)
        d.activeOrders = [
          ...d.activeOrders.filter(this.filterTpOrders()),
          ...newTpOrders,
        ]
        d.currentBalance.base = this.long
          ? d.currentBalance.base - filledBase
          : d.currentBalance.base + filledBase
        d.currentBalance.quote = this.long
          ? d.currentBalance.quote + filledQuote
          : d.currentBalance.quote - filledQuote
        const allFilled = this.long
          ? this.math.lte(
              d.currentBalance.base * d.avgPrice,
              symbol.quoteAsset.minAmount,
            ) &&
            this.math.lte(d.currentBalance.base, symbol.baseAsset.minAmount)
          : this.math.lte(
              d.currentBalance.quote,
              symbol.quoteAsset.minAmount,
            ) &&
            this.math.lte(
              d.currentBalance.quote / d.avgPrice,
              symbol.baseAsset.minAmount,
            )
        /* const profit = this.getProfit(d)
        if (profit) {
          d.profit = profit
        } */
        return { deal: d, order: allFilled ? lastSl : undefined }
      }
    } else if (
      ((botFunctions.isTrailingSl && d.trailingMode === TrailingModeEnum.tsl) ||
        (botFunctions.isTrailingTp &&
          d.trailingMode === TrailingModeEnum.ttp)) &&
      !this.combo
    ) {
      if (d.trailingMode && d.trailingLevel) {
        if (
          (this.long && b.low <= d.trailingLevel) ||
          (!this.long && b.high >= d.trailingLevel)
        ) {
          close = true
          closePrice = d.trailingLevel
        }
      }
    } else if (
      this.settings.useSl &&
      typeof d.slPerc !== 'undefined' &&
      (this.settings.dealCloseConditionSL === CloseConditionEnum.tp ||
        (this.settings.moveSL &&
          this.settings.moveSLForAll &&
          d.moveSlActivated)) &&
      !this.combo
    ) {
      const sl = d.slPerc
      const diff = this.long ? b.low - d.avgPrice : d.avgPrice - b.high

      if (diff / d.avgPrice - this.userFee * 2 <= sl) {
        close = true
        closePrice = d.avgPrice * (this.long ? 1 - -sl : 1 + -sl)
      }
    } else if (this.combo) {
      if (this.settings.useSl || this.settings.useTp) {
        const slPerc = +(this.settings.slPerc || '0')
        const tpPerc = +(this.settings.tpPerc || '0')
        const useTp =
          this.settings.useTp &&
          this.settings.dealCloseCondition === CloseConditionEnum.tp
        const useSl =
          this.settings.useSl &&
          this.settings.dealCloseConditionSL === CloseConditionEnum.tp
        const price = b.close
        const qty = Math.max(
          (this.long
            ? d.currentBalance.base
            : d.initialBalance.base - d.currentBalance.base) +
            (this.coinm ? d.profit.total * (this.long ? 1 : -1) : 0),
          0,
        )
        const quote =
          (this.long
            ? d.initialBalance.quote - d.currentBalance.quote
            : d.currentBalance.quote) +
          d.profit.total * (this.long ? 1 : -1)
        const quoteTp = qty * price
        const commission = qty * price * this.userFee
        const unpnl = (quoteTp - quote) * (this.long ? 1 : -1)
        const total = d.profit.total + unpnl - commission
        const denominator =
          (this.futures
            ? this.coinm
              ? d.usage.max.base * d.startPrice
              : d.usage.max.quote
            : this.long
            ? d.usage.max.quote
            : d.usage.max.base * d.startPrice) / this.leverage
        const perc = total / denominator
        if (
          isFinite(Math.abs(perc)) &&
          !isNaN(perc) &&
          !isNaN(this.math.round(perc * 100)) &&
          useSl &&
          slPerc >= perc * 100
        ) {
          close = true
          const requiredPrice =
            (denominator * (slPerc / 100) -
              d.profit.total +
              commission +
              quote * (this.long ? 1 : -1)) /
            (qty * (this.long ? 1 : -1))
          closePrice = requiredPrice
        }
        if (
          isFinite(Math.abs(perc)) &&
          !isNaN(perc) &&
          !isNaN(this.math.round(perc * 100)) &&
          useTp &&
          tpPerc <= perc * 100
        ) {
          close = true
          const requiredPrice =
            (denominator * (tpPerc / 100) -
              d.profit.total +
              commission +
              quote * (this.long ? 1 : -1)) /
            (qty * (this.long ? 1 : -1))
          closePrice = requiredPrice
        }
        /* if (close) {
          console.log(
            'sl',
            total,
            'total',
            perc,
            'perc',
            price,
            'price',
            d.profit.total,
            'deal',
            qty,
            'qty',
            quoteTp,
            'qtp',
            quote,
            'q',
            commission,
            'fee',
            { ...d },
          )
        } */
      }
    }
    if (close) {
      const slOrder = this.getTP(d, undefined, false, true)[0]
      slOrder.price =
        closePrice *
        (this.combo || (d.trailingLevel && d.trailingMode)
          ? 1
          : this.long
          ? 1 + this.userFee * 2
          : 1 - this.userFee * 2)
      const min = Math.min(b.low, b.close, b.open)
      const max = Math.max(b.high, b.close, b.open)
      slOrder.price =
        slOrder.price >= min && slOrder.price <= max
          ? slOrder.price
          : slOrder.price >= max
          ? max
          : slOrder.price <= min
          ? min
          : min
      this.updatePositionWithOrder(slOrder, b.symbol)
      return { deal: d, order: slOrder }
    }
    return { deal: d }
  }

  private checkMinTp(price: number, d: Deal) {
    if (
      this.settings.useMinTP &&
      this.settings.dealCloseCondition === CloseConditionEnum.techInd &&
      this.settings.minTp &&
      checkNumber(this.settings.minTp)
    ) {
      const min = +(this.settings.minTp ?? '0') / 100
      const diff = this.long ? price - d.avgPrice : d.avgPrice - price
      const current = diff / d.avgPrice - this.userFee * 2
      return current >= min
    }
    return true
  }

  closeAllDeals(b: FullBar, sl = false) {
    Strategy.deals = Strategy.deals.map((d) => {
      if (
        d.status === 'open' &&
        ((!sl && this.checkMinTp(b.open, d)) || sl) &&
        d.symbol.pair === b.symbol
      ) {
        const position = Strategy.emptyPositon
        Strategy.position.set(b.symbol, position)
        const tp = this.getTP(d, b.open, true, false)[0]
        return this.closeDeal(d, b, tp)
      }
      return d
    })
  }

  private closeMinigrid(minigrid: Minigrid): Minigrid {
    return { ...minigrid, status: 'close' }
  }

  private closeDeal(
    d: Deal,
    b: FullBar,
    tpOrder?: FullGrid,
    cbClose?: (price: number) => void,
    liquidationPrice?: number,
  ) {
    let closePrice = b.close
    let profit: ReturnType<typeof this.getProfit> | undefined
    d.status = 'closed'
    d.closedTime = tpOrder?.filledTime ?? b.time
    d.ordersHistory = d.ordersHistory.map((o) =>
      o.filledTime ? { ...o } : { ...o, filledTime: b.time },
    )
    d.duration = d.closedTime - d.startTime
    d.splitDuration = friendlyTime(d.duration)
    d.mingrids = d.mingrids.map((m) => this.closeMinigrid(m))
    d.liquidationPrice = liquidationPrice
    if (tpOrder && tpOrder.qty > 0) {
      const { price } = tpOrder
      closePrice = price
      d.closePrice = price
      d.filledOrders = [
        ...d.filledOrders.filter((fo) => fo.id !== tpOrder.id),
        { ...tpOrder, filledTime: b.time },
      ].map((o) => ({ ...o, dealId: d.id }))
      const _profit = this.getProfit(d, b.time)
      if (_profit) {
        d.profit = _profit
        profit = d.profit
      }
    } else {
      d.profit.perc = this.math.round(
        (d.profit.total /
          (this.futures
            ? this.coinm
              ? d.usage.max.base * d.startPrice
              : d.usage.max.quote
            : this.long
            ? d.usage.max.quote
            : d.usage.max.base * d.startPrice)) *
          100,
        2,
      )
      const precision = this.precision.get(d.symbol.pair) ?? 8
      d.profit.total = this.math.round(d.profit.total, precision + 3)
      d.profit.totalUsd = this.math.round(d.profit.totalUsd, 2)
      profit = d.profit
    }
    d = this.updateDealEquity(d)

    if (profit) {
      Strategy.balance += profit.total
      Strategy.balanceUsd += profit.totalUsd
      if (profit.total > 0 && profit.total > Strategy.maxProfit) {
        Strategy.maxProfit = profit.total
      }
      if (profit.total < 0 && profit.total < Strategy.maxLoss) {
        Strategy.maxLoss = profit.total
      }
      if (profit.totalUsd > 0 && profit.totalUsd > Strategy.maxProfitUsd) {
        Strategy.maxProfitUsd = profit.totalUsd
      }
      if (profit.totalUsd < 0 && profit.totalUsd < Strategy.maxLossUsd) {
        Strategy.maxLossUsd = profit.totalUsd
      }
      if (!Strategy.previousDeal && profit.total > 0) {
        Strategy.maxConsecutiveWins = 1
        Strategy.seriesWin.value = Strategy.balance - Strategy.initialBalance
        Strategy.seriesWin.valueUsd =
          Strategy.balanceUsd - Strategy.initialBalanceUsd
        Strategy.seriesWin.min = Strategy.initialBalance
        Strategy.seriesWin.max = Strategy.balance
        Strategy.seriesWin.minUsd = Strategy.initialBalanceUsd
        Strategy.seriesWin.maxUsd = Strategy.balanceUsd
        Strategy.seriesWin.perc = profit.totalUsd / Strategy.balanceUsd
      }
      if (!Strategy.previousDeal && profit.total < 0) {
        Strategy.maxConsecutiveLosses = 1
        Strategy.seriesLoss.value = Strategy.initialBalance - Strategy.balance
        Strategy.seriesLoss.valueUsd =
          Strategy.initialBalanceUsd - Strategy.balanceUsd
        Strategy.seriesLoss.min = Strategy.balance
        Strategy.seriesLoss.max = Strategy.initialBalance
        Strategy.seriesLoss.minUsd = Strategy.balanceUsd
        Strategy.seriesLoss.maxUsd = Strategy.initialBalanceUsd
        Strategy.seriesLoss.perc = profit.totalUsd / Strategy.balanceUsd
      }
      if (profit.total > 0) {
        if (Strategy.previousDeal && Strategy.previousDeal.profit.total < 0) {
          Strategy.seriesWin.count = 0
          Strategy.seriesLoss.count = 0
        }
        Strategy.seriesWin.count += 1
      }
      if (profit.total < 0) {
        if (Strategy.previousDeal && Strategy.previousDeal.profit.total > 0) {
          Strategy.seriesWin.count = 0
          Strategy.seriesLoss.count = 0
        }
        Strategy.seriesLoss.count += 1
      }
      Strategy.totalProfit += profit.total
      Strategy.totalProfitUsd += profit.totalUsd
      Strategy.totalProfitPerSymbol.set(
        d.symbol.pair,
        (Strategy.totalProfitPerSymbol.get(d.symbol.pair) ?? 0) + profit.total,
      )
      Strategy.totalProfitUsdPerSymbol.set(
        d.symbol.pair,
        (Strategy.totalProfitUsdPerSymbol.get(d.symbol.pair) ?? 0) +
          profit.totalUsd,
      )
    }
    if (Strategy.balanceUsd > Strategy.seriesWin.maxUsd) {
      Strategy.seriesWin.maxUsd = Strategy.balanceUsd
      Strategy.seriesWin.max = Strategy.balance
      if (Strategy.seriesWin.min === 0) {
        Strategy.seriesWin.min =
          Strategy.seriesLoss.min === 0
            ? Strategy.initialBalance
            : Math.min(Strategy.seriesLoss.min, Strategy.initialBalance)
        Strategy.seriesWin.minUsd =
          Strategy.seriesLoss.minUsd === 0
            ? Strategy.initialBalanceUsd
            : Math.min(Strategy.seriesLoss.minUsd, Strategy.initialBalanceUsd)
      }
      const tempValueUsd = Strategy.seriesWin.maxUsd - Strategy.seriesWin.minUsd
      if (tempValueUsd > Strategy.seriesWin.valueUsd) {
        Strategy.seriesWin.perc = Math.abs(
          tempValueUsd / Strategy.seriesWin.maxUsd,
        )
        Strategy.seriesWin.valueUsd = tempValueUsd
        Strategy.seriesWin.value =
          Strategy.seriesWin.max - Strategy.seriesWin.min
      }
    }
    if (Strategy.balanceUsd < Strategy.seriesWin.minUsd) {
      Strategy.seriesWin.min = Strategy.balance
      Strategy.seriesWin.max = Strategy.balance
      Strategy.seriesWin.minUsd = Strategy.balanceUsd
      Strategy.seriesWin.maxUsd = Strategy.balanceUsd
    }
    if (Strategy.balanceUsd < Strategy.seriesLoss.minUsd) {
      Strategy.seriesLoss.min = Strategy.balance
      Strategy.seriesLoss.minUsd = Strategy.balanceUsd
      if (Strategy.seriesLoss.max === 0) {
        Strategy.seriesLoss.max =
          Strategy.seriesWin.max === 0
            ? Strategy.initialBalance
            : Math.max(Strategy.seriesWin.max, Strategy.initialBalance)
        Strategy.seriesLoss.maxUsd =
          Strategy.seriesWin.maxUsd === 0
            ? Strategy.initialBalanceUsd
            : Math.max(Strategy.seriesWin.maxUsd, Strategy.initialBalanceUsd)
      }
      const tempValueUsd =
        Strategy.seriesLoss.maxUsd - Strategy.seriesLoss.minUsd
      if (tempValueUsd > Strategy.seriesLoss.valueUsd) {
        Strategy.seriesLoss.perc = Math.abs(
          tempValueUsd / Strategy.seriesLoss.maxUsd,
        )
        Strategy.seriesLoss.valueUsd = tempValueUsd
        Strategy.seriesLoss.value =
          Strategy.seriesLoss.max - Strategy.seriesLoss.min
      }
    }
    if (Strategy.balanceUsd > Strategy.seriesLoss.maxUsd) {
      Strategy.seriesLoss.max = Strategy.balance
      Strategy.seriesLoss.min = Strategy.balance
      Strategy.seriesLoss.maxUsd = Strategy.balanceUsd
      Strategy.seriesLoss.minUsd = Strategy.balanceUsd
    }
    if (Strategy.seriesWin.count > Strategy.maxConsecutiveWins) {
      Strategy.maxConsecutiveWins = Strategy.seriesWin.count
    }
    if (Strategy.seriesLoss.count > Strategy.maxConsecutiveLosses) {
      Strategy.maxConsecutiveLosses = Strategy.seriesLoss.count
    }
    Strategy.previousDeal = d
    Strategy.lastClosedDeal = b.time
    if (cbClose) {
      cbClose(closePrice)
    }
    return d
  }

  private getCandleType(b: FullBar) {
    return b.close >= b.open ? CandleTypeEnum.bull : CandleTypeEnum.bear
  }

  private checkTrailing(d: Deal, price: number, time: number) {
    const botFunctions = this.botFunctions.get(d.symbol.pair)
    if (!botFunctions) {
      return d
    }
    if (!(botFunctions.isTrailingSl || botFunctions.isTrailingTp)) {
      return d
    }
    const { trailingSl, trailingTp, trailingTpPerc, tpPerc, slPerc } =
      this.settings
    const sellDisplacement = this.userFee * 2
    if (!d.bestPrice && d.bestPriceSet) {
      d.bestPrice = Math.max(price, d.startPrice)
      d.bestPriceSet = true
    } else if (
      (this.long && price > (d.bestPrice ?? 0)) ||
      (!this.long && price < (d.bestPrice ?? Infinity))
    ) {
      d.bestPrice = price
    }
    if (!d.trailingMode && trailingSl) {
      d.trailingMode = TrailingModeEnum.tsl
    }
    if (d.trailingMode !== TrailingModeEnum.ttp && trailingTp) {
      const unPnL =
        (this.long
          ? d.currentBalance.base * price +
            d.currentBalance.quote -
            d.initialBalance.quote
          : d.currentBalance.quote -
            (d.initialBalance.base - d.currentBalance.base) * price) /
        (this.long ? d.usage.current.quote : d.usage.current.base * price)
      if (trailingTpPerc && unPnL > +tpPerc / 100 + sellDisplacement) {
        d.trailingMode = TrailingModeEnum.ttp
      }
    }
    if (!d.trailingMode) {
      d.bestPrice = 0
    }
    const sl = (+slPerc / 100 + this.userFee * 2) * (this.long ? 1 : -1)
    const tp =
      (+(trailingTpPerc ?? '0') / 100 + this.userFee * 2) * (this.long ? 1 : -1)
    const newTrailingLevel = d.bestPrice
      ? d.trailingMode === TrailingModeEnum.tsl && slPerc
        ? d.bestPrice * (1 + sl)
        : d.trailingMode === TrailingModeEnum.ttp && trailingTpPerc
        ? d.bestPrice * (1 - tp)
        : 0
      : 0
    if (newTrailingLevel !== d.trailingLevel && !this.combo) {
      d.trailingLevel = newTrailingLevel
      const newSl = this.getSlHistoryLine(d, time)
      d = this.replaceSlHistoryLine(d, newSl, time)
    }

    return d
  }

  private checkPosition(b: FullBar) {
    if (!this.futures) {
      return
    }
    let current = Strategy.position.get(b.symbol)
    if (!current) {
      return
    }
    const long = current.side === PositionSide.LONG
    const price = long ? b.low : b.high
    const minPrice = Strategy.minPrice.get(b.symbol) ?? 0
    const maxPrice = Strategy.maxPrice.get(b.symbol) ?? 0
    if (minPrice === 0 || minPrice > b.low) {
      Strategy.minPrice.set(b.symbol, b.low)
    }
    if (maxPrice === 0 || maxPrice < b.high) {
      Strategy.maxPrice.set(b.symbol, b.high)
    }
    const close = long
      ? current.liquidationPrice > price
      : current.liquidationPrice < price
    if (close) {
      Strategy.deals = Strategy.deals.map((d) => {
        if (current && d.symbol.pair === b.symbol && d.status === 'open') {
          const tp = this.getTP(d, current.liquidationPrice, true, false)[0]
          return this.closeDeal(d, b, tp, undefined, current.liquidationPrice)
        }
        return d
      })
      current = Strategy.emptyPositon
      if (this.settings.startCondition === StartConditionEnum.asap) {
        this.openDeal(current.liquidationPrice, b.time, b.high, b.low, b.symbol)
      }
    }
    Strategy.position.set(b.symbol, current)
  }

  private checkCloseTimer(d: Deal, b: FullBar) {
    if (
      this.settings.closeByTimer &&
      this.settings.closeByTimerValue &&
      this.settings.closeByTimerUnits &&
      this.settings.useTp
    ) {
      const closeTime =
        d.startTime +
        this.settings.closeByTimerValue *
          (this.settings.closeByTimerUnits === CooldownUnits.seconds
            ? 1000
            : this.settings.closeByTimerUnits === CooldownUnits.minutes
            ? 60 * 1000
            : this.settings.closeByTimerUnits === CooldownUnits.hours
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000)
      if (closeTime <= b.time) {
        return this.getTP(d, b.open, true, false, closeTime)[0]
      }
    }
  }

  public async checkDeals(b: FullBar, cbClose?: (price: number) => void) {
    if (this._stop) {
      return
    }
    for (let d of Strategy.deals.filter(
      (dd) => dd.status === 'open' && dd.symbol.pair === b.symbol,
    )) {
      let tpOrder: FullGrid | undefined
      tpOrder = this.checkCloseTimer(d, b)
      const bOpenHigh = { ...b, low: b.open }
      const bLowClose = { ...b, high: b.close }
      const bHighClose = { ...b, low: b.close }
      const bOpenLow = { ...b, high: b.open }
      const candleType = this.getCandleType(b)
      if (this.long && !tpOrder) {
        if (candleType === CandleTypeEnum.bull) {
          // open -> low. Check DCA and SL
          d = this.processGridOrders(d, b)
          if (d.status === 'closed') {
            return
          }
          d = this.processDCAOrders(d, b)
          const slReturn = this.getSLOrder(d, b)
          d = slReturn.deal
          if (slReturn.order) {
            tpOrder = slReturn.order
          }
          // low -> high. Check TP and move SL and check trailing
          if (!tpOrder) {
            const tpReturn = this.filterTP(d, bOpenHigh)
            d = tpReturn.deal
            tpOrder = tpReturn.order
            d = this.checkValue(b, d)
            d = this.checkTrailing(d, b.high, b.time)
          }
          // high -> close. Check SL if it was moved
          if (!tpOrder) {
            const slNext = this.getSLOrder(d, bHighClose)
            d = slNext.deal
            if (slNext.order) {
              tpOrder = slNext.order
            }
          }
        }
        if (candleType === CandleTypeEnum.bear) {
          // open -> high movement. Check TP and move SL and check trailing
          const tpReturn = this.filterTP(d, bOpenHigh)
          d = tpReturn.deal
          tpOrder = tpReturn.order
          d = this.checkValue(bOpenHigh, d)
          d = this.checkTrailing(d, b.high, b.time)
          // high -> low movement. Check SL if it was moved. If SL not filled check DCA
          if (!tpOrder) {
            d = this.processGridOrders(d, b)
            if (d.status === 'closed') {
              continue
            }
            d = this.processDCAOrders(d, b)

            const slReturn = this.getSLOrder(d, b)
            d = slReturn.deal
            if (slReturn.order) {
              tpOrder = slReturn.order
            }
          }
          // low -> close movement. Check TP
          if (!tpOrder) {
            const tpReturnNext = this.filterTP(d, bLowClose)
            d = tpReturnNext.deal
            tpOrder = tpReturnNext.order
          }
        }
      } else if (!tpOrder) {
        if (candleType === CandleTypeEnum.bull) {
          // open -> low movement. Check TP and move SL and check trailing
          const tpReturn = this.filterTP(d, bOpenLow)
          d = tpReturn.deal
          tpOrder = tpReturn.order
          d = this.checkValue(bOpenLow, d)
          d = this.checkTrailing(d, b.low, b.time)
          // low -> high movement. Check moved SL, If SL not filled, check DCA
          if (!tpOrder) {
            d = this.processGridOrders(d, b)
            if (d.status === 'closed') {
              return
            }
            d = this.processDCAOrders(d, b)

            const slReturn = this.getSLOrder(d, b)
            d = slReturn.deal
            if (slReturn.order) {
              tpOrder = slReturn.order
            }
          }
          // high -> close. Check TP
          if (!tpOrder) {
            const tpReturnNext = this.filterTP(d, bHighClose)
            d = tpReturnNext.deal
            tpOrder = tpReturnNext.order
          }
        }
        if (candleType === CandleTypeEnum.bear) {
          // open -> high movement. Check for filled DCA and SL
          d = this.processGridOrders(d, bOpenHigh)
          if (d.status === 'closed') {
            return
          }
          d = this.processDCAOrders(d, bOpenHigh)
          const slReturn = this.getSLOrder(d, bOpenHigh)
          d = slReturn.deal
          if (slReturn.order) {
            tpOrder = slReturn.order
          }

          // high -> low movement. Check for filled TP and move SL and check trailing
          if (!tpOrder) {
            const tpReturn = this.filterTP(d, b)
            d = tpReturn.deal
            tpOrder = tpReturn.order
            d = this.checkValue(b, d)
            d = this.checkTrailing(d, b.low, b.time)
          }
          // low -> close. Check SL if it was moved
          if (!tpOrder) {
            const slReturnNext = this.getSLOrder(d, bLowClose)
            d = slReturnNext.deal
            if (slReturnNext.order) {
              tpOrder = slReturnNext.order
            }
          }
        }
      }
      if (tpOrder) {
        d = this.closeDeal(d, b, tpOrder, cbClose)
      }
      Strategy.deals = [...Strategy.deals.filter((dd) => dd.id !== d.id), d]
    }
    this.checkPosition(b)
    if ((this.long || this.futures) && !this.coinm) {
      const all = Strategy.deals
        .filter((df) => df.status === 'open')
        .reduce((acc, deal) => (acc += deal.usage.current.quote), 0)
      if (all > Strategy.maxUsage.bot) {
        Strategy.maxUsage.bot = all
        Strategy.maxUsage.botQuote = all
      }
    } else if (!this.long || this.coinm) {
      const all = Strategy.deals
        .filter((df) => df.status === 'open')
        .reduce((acc, deal) => (acc += deal.usage.current.base), 0)
      if (all > Strategy.maxUsage.bot) {
        Strategy.maxUsage.bot = all
        Strategy.maxUsage.botQuote = Strategy.deals
          .filter((df) => df.status === 'open')
          .reduce(
            (acc, deal) =>
              acc +
              deal.filledOrders
                .filter(
                  (df) =>
                    df.type &&
                    [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(
                      df.type,
                    ),
                )
                .reduce((acco, v) => acco + v.qty * v.price, 0),
            0,
          )
      }
    }
  }

  private checkValue(b: FullBar, d: Deal) {
    if (d.changed) {
      return d
    }
    const botFunctions = this.botFunctions.get(d.symbol.pair)
    if (!botFunctions) {
      return d
    }
    if (botFunctions.isTrailingSl || botFunctions.isTrailingTp) {
      return d
    }
    let unPnL = 0
    let usage = 0
    if (this.long) {
      unPnL =
        d.currentBalance.base * b.high +
        d.currentBalance.quote -
        d.initialBalance.quote
      usage = this.futures
        ? this.coinm
          ? d.usage.current.quote / b.high
          : d.usage.current.quote
        : d.usage.current.quote
    }
    if (!this.long) {
      unPnL =
        d.currentBalance.quote -
        (d.initialBalance.base - d.currentBalance.base) * b.low
      usage = this.futures
        ? this.coinm
          ? d.usage.current.base * b.low
          : d.usage.current.quote
        : d.usage.current.base * b.low
    }
    if (
      this.settings.moveSL &&
      typeof this.settings.moveSLTrigger !== 'undefined' &&
      typeof this.settings.moveSLValue !== 'undefined' &&
      (this.settings.dealCloseConditionSL === CloseConditionEnum.tp ||
        (this.settings.moveSLForAll && !d.moveSlActivated))
    ) {
      const trigger = +this.settings.moveSLTrigger / 100
      const value = +this.settings.moveSLValue / 100
      if (unPnL / usage - this.userFee * 2 >= trigger) {
        d.changed = true
        d.slPerc = value
        d.moveSlActivated = true
        const slOrder = this.getSlHistoryLine(d, b.time)
        d = this.replaceSlHistoryLine(d, slOrder, b.time)
      }
    }
    return d
  }

  private getTP(
    deal: Deal,
    _price?: number,
    aggregate = false,
    sl = false,
    time?: number,
  ) {
    const {
      settings: { tpPerc, useMultiTp, multiTp, useMultiSl, multiSl },
    } = this
    const symbol = this.symbols.get(deal.symbol.pair)
    const botFunctions = this.botFunctions.get(deal.symbol.pair)
    if (!symbol || !botFunctions) {
      return []
    }
    const { filledOrders, tpSlTargetFilled, avgPrice, slPerc } = deal
    const precision = botFunctions.utils.getBaseAssetPrecision(symbol)
    const filledRegular = filledOrders.filter(
      (o) =>
        o.type && [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(o.type),
    )
    const filledTP = filledOrders.filter(
      (o) =>
        o.type && [DCAOrderTypeEnum.tp, DCAOrderTypeEnum.sl].includes(o.type),
    )
    const qty = this.combo
      ? this.long
        ? deal.currentBalance.base
        : deal.initialBalance.base - deal.currentBalance.base
      : filledRegular.reduce((acc, g) => acc + g.qty, 0) -
        filledTP.reduce((acc, g) => acc + g.qty, 0)
    const origQty = qty
    const quote = this.combo
      ? deal.currentBalance.quote
      : filledRegular.reduce((acc, g) => acc + g.qty * g.price, 0) -
        filledTP.reduce((acc, g) => acc + g.qty * g.price, 0)
    const sellDisplacement = this.userFee * 2
    const priceDisplacement = this.long
      ? 1 + sellDisplacement
      : 1 - sellDisplacement
    const price = this.combo
      ? deal.avgPrice * priceDisplacement
      : (quote / qty) * priceDisplacement
    let tpPrice = this.math.round(
      _price ??
        price *
          (1 + (this.long ? 1 : -1) * (sl ? +(slPerc || '0') : +tpPerc / 100)),
      symbol.priceAssetPrecision,
    )
    if (tpPrice === deal.avgPrice) {
      tpPrice = this.math.round(
        (tpPrice +
          (this.long ? 1 : -1) *
            Number(`${1}e-${symbol.priceAssetPrecision}`)) *
          (this.long ? 1 + sellDisplacement : 1 - sellDisplacement),
        symbol.priceAssetPrecision,
      )
    }
    const tpOrder: FullGrid = {
      qty,
      price: tpPrice,
      type: DCAOrderTypeEnum.tp,
      side: this.long ? BotOrderSideEnum.sell : BotOrderSideEnum.buy,
      id: botFunctions.utils.id(20),
      filledTime: time,
    }
    if (qty < 0 && this.combo) {
      return [{ ...tpOrder, qty: 0 }]
    }
    if (this.profitBase) {
      const newQty = this.math.round(
        (origQty * deal.avgPrice) / tpOrder.price,
        precision,
        true,
      )
      tpOrder.qty = this.coinm
        ? newQty
        : this.long
        ? Math.min(tpOrder.qty, newQty)
        : sl
        ? Math.min(tpOrder.qty, newQty)
        : Math.max(tpOrder.qty, newQty)
    }
    if (
      tpOrder.price * tpOrder.qty < symbol.quoteAsset.minAmount &&
      this.combo
    ) {
      return [{ ...tpOrder, qty: 0 }]
    }
    /* if (
      tpOrder.price * tpOrder.qty < symbol.quoteAsset.minAmount &&
      !this.futures
    ) {
      tpOrder.qty = this.math.round(
        symbol.quoteAsset.minAmount / tpOrder.price,
        precision,
        false,
        true,
      )
    } */
    let tpOrders = [tpOrder]
    if (aggregate) {
      return tpOrders
    }
    if (!sl && useMultiTp) {
      let restQty = tpOrder.qty
      let end = false
      tpOrders = []
      const usedTp = (multiTp ?? [])
        .filter((mtp) => (tpSlTargetFilled ?? []).includes(mtp.uuid))
        .reduce((acc, tp) => acc + +tp.amount, 0)

      ;(multiTp ?? [])
        .sort((a, b) => +a.target - +b.target)
        .map((tp) => {
          if (end || tpSlTargetFilled?.includes(tp.uuid)) {
            return null
          }
          let priceTp = this.math.round(
            avgPrice *
              (1 + (this.long ? 1 : -1) * (+tp.target / 100)) *
              priceDisplacement,
            symbol.priceAssetPrecision,
          )
          if (priceTp === avgPrice) {
            priceTp = this.math.round(
              avgPrice +
                (this.long ? 1 : -1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
          let qtyTp = this.math.round(
            tpOrder.qty * (+tp.amount / (100 - usedTp)),
            precision,
          )
          if (qtyTp > restQty) {
            qtyTp = restQty
          }
          /* if (qtyTp < symbol.baseAsset.minAmount) {
            qtyTp = symbol.baseAsset.minAmount
          }
          if (priceTp * qtyTp < symbol.quoteAsset.minAmount) {
            qtyTp = symbol.quoteAsset.minAmount / priceTp
          } */
          const modQty = this.math.remainder(qtyTp, symbol.baseAsset.step)
          if (modQty !== 0) {
            qtyTp = this.math.round(
              qtyTp - modQty + symbol.baseAsset.step,
              precision,
              true,
            )
          }
          restQty -= qtyTp
          if (
            restQty < symbol.baseAsset.minAmount ||
            restQty * priceTp < symbol.quoteAsset.minAmount ||
            restQty < 0
          ) {
            end = true
            qtyTp =
              restQty > 0 && restQty > symbol.baseAsset.step
                ? this.math.round(qtyTp + restQty, precision)
                : qtyTp
          }
          return {
            ...tpOrder,
            qty: qtyTp,
            price: priceTp,
            id: botFunctions.utils.id(20),
            tpSlTarget: tp.uuid,
          }
        })
        .forEach((o) => {
          if (o) {
            tpOrders.push(o)
          }
        })
    }
    if (sl && useMultiSl) {
      let restQty = tpOrder.qty
      let end = false
      tpOrders = []
      const usedSL = (multiSl ?? [])
        .filter((msl) => (tpSlTargetFilled ?? []).includes(msl.uuid))
        .reduce((acc, _sl) => acc + +_sl.amount, 0)
      ;(multiSl ?? [])
        .sort((a, b) => +b.target - +a.target)
        .map((tp) => {
          if (end || deal?.tpSlTargetFilled?.includes(tp.uuid)) {
            return null
          }
          let priceSl = this.math.round(
            avgPrice *
              (1 + (this.long ? 1 : -1) * (+tp.target / 100)) *
              priceDisplacement,
            symbol.priceAssetPrecision,
          )
          if (priceSl === avgPrice) {
            priceSl = this.math.round(
              avgPrice +
                (this.long ? 1 : -1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
          let qtySl = this.math.round(
            tpOrder.qty * (+tp.amount / (100 - usedSL)),
            precision,
          )
          if (qtySl > restQty) {
            qtySl = restQty
          }
          if (qtySl < symbol.baseAsset.minAmount) {
            qtySl = symbol.baseAsset.minAmount
          }
          if (priceSl * qtySl < symbol.quoteAsset.minAmount) {
            qtySl = symbol.quoteAsset.minAmount / priceSl
          }
          const modQty = this.math.remainder(qtySl, symbol.baseAsset.step)
          if (modQty !== 0) {
            qtySl = this.math.round(
              qtySl - modQty + symbol.baseAsset.step,
              precision,
              true,
            )
          }
          restQty -= qtySl
          if (
            restQty < symbol.baseAsset.minAmount ||
            restQty * priceSl < symbol.quoteAsset.minAmount ||
            restQty < 0
          ) {
            end = true
            qtySl =
              restQty > 0 && restQty > symbol.baseAsset.step
                ? this.math.round(qtySl + restQty, precision)
                : qtySl
          }

          return {
            ...tpOrder,
            qty: qtySl,
            price: priceSl,
            id: botFunctions.utils.id(20),
            tpSlTarget: tp.uuid,
            type: DCAOrderTypeEnum.sl,
          }
        })
        .forEach((o) => {
          if (o) {
            tpOrders.push(o)
          }
        })
    }
    return tpOrders
  }

  private getUsage(d: Deal) {
    const base = this.futures
      ? this.coinm
        ? this.long
          ? d.currentBalance.base
          : d.initialBalance.base - d.currentBalance.base
        : 0
      : this.long
      ? 0
      : d.initialBalance.base - d.currentBalance.base

    const quote = this.futures
      ? this.coinm
        ? 0
        : !this.long
        ? d.currentBalance.quote
        : d.initialBalance.quote - d.currentBalance.quote
      : this.long
      ? d.initialBalance.quote - d.currentBalance.quote
      : 0

    const usage = {
      current: {
        base: this.futures ? (this.coinm ? base : 0) : this.long ? 0 : base,
        quote: this.futures ? (this.coinm ? 0 : quote) : this.long ? quote : 0,
      },
    }
    return usage
  }

  private getProfit(d: Deal, time: number) {
    const { filledOrders } = d
    const { userFee } = this
    const usdRate = this.usdRate.get(d.symbol.pair) ?? 1
    const precision = this.precision.get(d.symbol.pair) ?? 8
    const commission = filledOrders
      .filter((o) => (this.combo ? o.type === DCAOrderTypeEnum.tp : true))
      .reduce(
        (acc, v) =>
          (acc += this.combo
            ? v.qty * v.price * userFee
            : this.profitBase
            ? v.qty * userFee
            : v.qty * v.price * userFee),
        0,
      )
    const regularOrders = filledOrders.filter(
      (fo) =>
        fo.type &&
        [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(fo.type),
    )

    const quote = this.combo
      ? (this.long
          ? d.initialBalance.quote - d.currentBalance.quote
          : d.currentBalance.quote) +
        d.profit.total * (this.long ? 1 : -1)
      : regularOrders.reduce((acc, ro) => (acc += ro.qty * ro.price), 0)
    const base = this.combo
      ? Math.max(
          this.long
            ? d.currentBalance.base
            : d.initialBalance.base - d.currentBalance.base,
          0,
        )
      : regularOrders.reduce((acc, ro) => (acc += ro.qty), 0)
    const tpOrder = filledOrders.filter(
      (fo) =>
        fo.type && [DCAOrderTypeEnum.tp, DCAOrderTypeEnum.sl].includes(fo.type),
    )
    const qty = tpOrder.reduce((acc, tpo) => acc + tpo.qty, 0)
    const quoteTp = tpOrder.reduce((acc, tpo) => acc + tpo.qty * tpo.price, 0)
    let price = quoteTp / qty
    price = isNaN(price) ? tpOrder[0]?.price : price
    const pureProfit =
      (this.profitBase
        ? base - qty + (quoteTp - quote) / price
        : quoteTp - quote + (qty - base) * price) *
        (this.long ? 1 : -1) -
      (d.liquidationPrice ? 0 : commission)
    if (pureProfit !== 0 && this.combo) {
      Strategy.profits.push({
        total: pureProfit,
        totalUsd: pureProfit * usdRate,
        time,
      })
    }
    const total = d.profit.total + pureProfit

    const totalUsd = total * usdRate
    const denominator = this.combo
      ? this.futures
        ? this.coinm
          ? d.usage.max.base
          : d.usage.max.quote
        : this.long
        ? d.usage.max.quote
        : d.usage.max.base * d.startPrice
      : this.profitBase
      ? base
      : quote
    const perc = this.math.round(
      (total / denominator) * 100 * /* this.combo ? 1 : */ this.leverage,
      2,
      false,
      true,
    )

    /* console.log(
      'profit',
      total,
      'total',
      perc,
      'perc',
      price,
      'price',
      d.profit.total,
      'deal',
      qty,
      'qty',
      base,
      'base',
      quoteTp,
      'qtp',
      quote,
      'q',
      tpOrder,
      'tp',
      commission,
      'fee',
      { ...d },
      'deal',
    ) */

    return {
      total: this.math.round(total, precision, false, true),
      totalUsd: this.math.round(totalUsd, 2),
      perc,
    }
  }

  get long() {
    return this.settings.strategy === StrategyEnum.long
  }

  get profitBase() {
    return (
      (this.futures && this.coinm) ||
      (!this.futures && this.settings.profitCurrency === 'base')
    )
  }

  private getRate() {
    const usdRateQuote = this.usdRateQuote.values().next().value ?? 1
    const usdRateBase = this.usdRateBase.values().next().value ?? 1
    const usdRate = this.usdRate.values().next().value ?? 1
    return this.futures
      ? usdRate
      : this.long
      ? this.profitBase
        ? usdRateQuote
        : usdRate
      : this.profitBase
      ? usdRate
      : usdRateBase
  }

  private getMaxLeverage(s: string) {
    if (!this.futures) {
      return
    }
    const symbol = this.symbols.get(s)
    const botFunctions = this.botFunctions.get(s)
    if (!symbol || !botFunctions) {
      return
    }
    const startPrice = this.long
      ? Strategy.maxPrice.get(s) ?? 0
      : Strategy.minPrice.get(s) ?? 0
    const extremum = this.long
      ? Strategy.minPrice.get(s) ?? 0
      : Strategy.maxPrice.get(s) ?? 0
    if (!startPrice || !extremum) {
      return
    }
    const dealOrders = botFunctions.createOrders(
      startPrice,
      true,
      undefined,
      undefined,
      this.balances,
      true,
    )
    const regular = dealOrders
      .filter(
        (d) =>
          d.type === DCAOrderTypeEnum.bo || d.type === DCAOrderTypeEnum.dca,
      )
      .filter((o) => (this.long ? o.price > extremum : o.price < extremum))
    if (regular.length) {
      const avgPrice = regular[regular.length - 1]?.avgPrice || 0
      const maxLeverage = this.long
        ? 1 / (1 - extremum / avgPrice)
        : 1 / (extremum / avgPrice - 1)
      return Math.max(this.math.round(maxLeverage, 0, true), 1)
    }
  }

  private getConfidenceGrade(): { level: string; number: number } {
    const number = Strategy.deals.filter(
      (d) =>
        d.status === 'closed' && d.closedTime && d.closedTime > d.startTime,
    ).length
    return {
      level:
        number < 107
          ? 'F'
          : number >= 107 && number < 133
          ? 'E'
          : number >= 133 && number < 164
          ? 'D'
          : number >= 164 && number < 208
          ? 'C'
          : number >= 208 && number < 273
          ? 'B'
          : number >= 273 && number < 385
          ? 'A'
          : 'A+',
      number,
    }
  }

  private getBuyAndHold(
    firstDataMap?: Map<string, FullBar>,
    lastDataMap?: Map<string, FullBar>,
  ) {
    if (!firstDataMap || !lastDataMap) {
      return
    }
    const firstData = firstDataMap.get(Strategy.initialBalanceSymbol)
    const lastData = lastDataMap.get(Strategy.initialBalanceSymbol)
    if (!lastData || !firstData) {
      return
    }
    const usdRateQuote = this.usdRateQuote.get(firstData.symbol) ?? 1
    const usdRate = this.usdRate.get(firstData.symbol) ?? 1
    const firstPrice = firstData?.close
    const lastPrice = lastData?.close
    const buyAndHoldUsage =
      Strategy.initialBalance * (this.profitBase ? firstPrice : 1)
    const buyAndHold =
      firstPrice && lastPrice
        ? ((buyAndHoldUsage / firstPrice) * lastPrice - buyAndHoldUsage) /
          this.leverage
        : 0
    /* const buyAndHoldLastEquity =
      (firstPrice && lastPrice
        ? (buyAndHoldUsage / firstPrice) * lastPrice
        : 0) * this.leverage */
    const lowestData = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )[0]
    const buyAndHoldEquity: BuyAndHoldEquity[] = []
    /*     buyAndHoldEquity.push({ value: buyAndHoldUsage, time: firstData.time })
    buyAndHoldEquity.push({ value: buyAndHoldLastEquity, time: lastData.time }) */
    if (lowestData.bar.length > 2) {
      lowestData.bar = lowestData.bar.filter(
        (b) => b.time >= Strategy.start && b.symbol === firstData.symbol,
      )
      const steps = Math.min(Math.floor(lowestData.bar.length / 2), 500)
      const step = Math.floor(lowestData.bar.length / steps)
      const data: FullBar[] = []
      data.push(firstData)
      for (const i of [...Array(steps).keys()]) {
        const d = lowestData.bar[i * step]
        if (
          d &&
          buyAndHoldEquity.filter((bh) => bh.time === d.time).length === 0
        ) {
          data.push(d)
        }
      }
      if (
        buyAndHoldEquity.filter((bh) => bh.time === lastData.time).length === 0
      ) {
        data.push(lastData)
      }

      buyAndHoldEquity.push({
        value: this.math.round(
          (buyAndHoldUsage * (this.profitBase ? usdRateQuote : usdRate)) /
            this.leverage,
          4,
        ),
        time: firstData.time,
      })
      for (const d of data) {
        const lp = d.close
        const bh = this.math.round(
          firstPrice && lp
            ? ((buyAndHoldUsage / firstPrice) *
                lp *
                (this.profitBase ? usdRateQuote : usdRate)) /
                this.leverage
            : 0,
          3,
        )
        buyAndHoldEquity.push({ value: bh, time: d.time })
      }
    }
    return {
      buyAndHold,
      buyAndHoldUsd: buyAndHold * (this.profitBase ? usdRateQuote : usdRate),
      buyAndHoldUsage,
      buyAndHoldEquity: buyAndHoldEquity.sort((a, b) => a.time - b.time),
    }
  }

  public returnResult(
    firstData: Map<string, FullBar>,
    lastData: Map<string, FullBar>,
    loadingTime: number,
    processingTime: number,
  ): DCABacktestingResult {
    const startResultProcessing = new Date().getTime()
    Strategy.deals = Strategy.deals.map((d) => {
      const symbol = this.symbols.get(d.symbol.pair)
      if (!symbol) {
        return d
      }
      return {
        ...d,
        avgPrice: this.math.round(d.avgPrice, symbol.priceAssetPrecision),
        closePrice: d.closePrice
          ? this.math.round(d.closePrice, symbol.priceAssetPrecision)
          : d.closePrice,
        startPrice: this.math.round(d.startPrice, symbol.priceAssetPrecision),
        duration:
          d.status === 'open'
            ? (lastData.get(d.symbol.pair)?.time ?? new Date().getTime()) -
              d.startTime
            : d.duration,
        splitDuration:
          d.status === 'open'
            ? friendlyTime(
                (lastData.get(d.symbol.pair)?.time ?? new Date().getTime()) -
                  d.startTime,
              )
            : d.splitDuration,
      }
    })
    let maxTheoreticalUsage =
      Strategy.deals.length > 0
        ? Strategy.deals[0].initialOrders
            .filter((io) => io.type !== DCAOrderTypeEnum.tp)
            .reduce(
              (acc, d) =>
                this.futures
                  ? this.coinm
                    ? (acc += d.qty)
                    : (acc += d.qty * d.price)
                  : !this.long
                  ? (acc += d.qty)
                  : (acc += d.qty * d.price),
              0,
            )
        : 0
    const {
      maxNumberOfOpenDeals: maxNumberOfOpenDealsString,
      maxDealsPerPair,
      useMulti,
    } = this.settings
    let maxNumberOfOpenDeals = 1
    if (
      maxNumberOfOpenDealsString &&
      maxNumberOfOpenDealsString !== '' &&
      !isNaN(+maxNumberOfOpenDealsString) &&
      +maxNumberOfOpenDealsString > 0 &&
      (Strategy.multi || (!Strategy.multi && !useMulti))
    ) {
      maxNumberOfOpenDeals = +maxNumberOfOpenDealsString
    }
    if (
      maxDealsPerPair &&
      maxDealsPerPair !== '' &&
      !isNaN(+maxDealsPerPair) &&
      +maxDealsPerPair > 0 &&
      !Strategy.multi &&
      useMulti
    ) {
      maxNumberOfOpenDeals = +maxDealsPerPair
    }
    maxTheoreticalUsage *= +maxNumberOfOpenDeals
    maxTheoreticalUsage /= this.leverage
    const precision = this.precision.values().next().value ?? 8
    const precisionQuote = this.precisionQuote.values().next().value ?? 8
    const totalProfit = this.math.round(Strategy.totalProfit, precision)
    const totalProfitUsd = this.math.round(Strategy.totalProfitUsd, 2)
    const totalDuration = Strategy.deals.reduce(
      (acc, d) => (acc += d.duration),
      0,
    )
    const lastDataItem = lastData?.values().next().value
    const firstDataItem = firstData?.get(lastDataItem?.symbol ?? '')
    const workingTime = Strategy.workingShift.reduce(
      (acc, ws) =>
        (acc += (ws.end || lastDataItem?.time || ws.start) - ws.start),
      0,
    )
    const closedDeals = Strategy.deals.filter((d) => d.status === 'closed')
    const avgDuration =
      Strategy.deals.length > 0
        ? this.math.round(totalDuration / Strategy.deals.length, 0)
        : 0
    const openedDeals = Strategy.deals.filter((d) => d.status === 'open')
    const workingDays = this.math.round(workingTime / (24 * 60 * 60 * 1000), 4)
    const profitDeals = Strategy.deals.filter(
      (d) => d.profit.perc > 0 && d.status === 'closed',
    )
    const lossDeals = Strategy.deals.filter(
      (d) => d.profit.perc <= 0 && d.status === 'closed',
    )
    const profitDuration = profitDeals.reduce(
      (acc, d) => (acc += d.duration),
      0,
    )
    const avgProfitDuration =
      profitDeals.length > 0
        ? this.math.round(profitDuration / profitDeals.length, 0)
        : 0
    const maxProfitDuration = Math.max(...profitDeals.map((d) => d.duration), 0)
    let stDevProfit = this.math.stDev(profitDeals.map((d) => d.profit.perc))
    stDevProfit = isNaN(stDevProfit) ? 0 : stDevProfit
    const lossDuration = lossDeals.reduce((acc, d) => (acc += d.duration), 0)
    const avgLossDuration =
      lossDeals.length > 0
        ? this.math.round(lossDuration / lossDeals.length, 0)
        : 0
    const maxLossDuration = Math.max(...lossDeals.map((d) => d.duration), 0)

    const allProfit = profitDeals.reduce((acc, d) => (acc += d.profit.total), 0)
    const allProfitUsd = profitDeals.reduce(
      (acc, d) => (acc += d.profit.totalUsd),
      0,
    )
    const allLoss = lossDeals.reduce((acc, d) => (acc += d.profit.total), 0)
    const allLossUsd = lossDeals.reduce(
      (acc, d) => (acc += d.profit.totalUsd),
      0,
    )
    const avgUsable =
      Strategy.deals.length > 0
        ? this.math.round(
            Strategy.deals.reduce(
              (acc, d) =>
                this.futures
                  ? this.coinm
                    ? (acc += d.usage.current.base)
                    : (acc += d.usage.current.quote)
                  : !this.long
                  ? (acc += d.usage.current.base)
                  : (acc += d.usage.current.quote),
              0,
            ) /
              Strategy.deals.length /
              this.leverage,
            precision,
          )
        : 0
    let unrealizedPnL = 0
    let unrealizedPnLUsd = 0
    let unrealizedUsage = 0

    if (openedDeals.length > 0) {
      for (const od of openedDeals) {
        const symbol = this.symbols.get(od.symbol.pair)
        if (!symbol) {
          continue
        }
        const price = this.prices.find((p) => p.symbol === symbol.pair)
        if (price) {
          const tp = this.getTP(
            od,
            lastData.get(od.symbol.pair)?.close ?? price.price,
            true,
            false,
          )[0]
          const { price: tpPrice } = tp
          const qty = tp?.qty ?? 0
          if (qty === 0) {
            continue
          }
          const filledOrders = od.filledOrders.filter(
            (fo) =>
              fo.type &&
              [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(fo.type),
          )
          const filledTPOrders = od.filledOrders.filter(
            (fo) =>
              fo.type &&
              [DCAOrderTypeEnum.tp, DCAOrderTypeEnum.sl].includes(fo.type),
          )
          const quote = this.combo
            ? (this.long
                ? od.initialBalance.quote - od.currentBalance.quote
                : od.currentBalance.quote) + od.profit.total
            : filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0) -
              filledTPOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
          const base = this.combo
            ? this.long
              ? od.currentBalance.base
              : od.initialBalance.base - od.currentBalance.base
            : filledOrders.reduce((acc, fo) => (acc += fo.qty), 0) -
              filledTPOrders.reduce((acc, fo) => (acc += fo.qty), 0)
          const commission = od.filledOrders.reduce(
            (acc, v) =>
              (acc += this.combo
                ? v.qty * v.price * this.userFee
                : this.profitBase
                ? v.qty * this.userFee
                : v.qty * v.price * this.userFee),
            0,
          )
          const unPnl =
            od.profit.total +
            (this.profitBase
              ? base -
                qty +
                ((qty * tpPrice - quote) / tpPrice) * (this.long ? 1 : -1)
              : this.combo
              ? qty * tpPrice - quote
              : qty * tpPrice -
                quote +
                (qty - base) * tpPrice * (this.long ? 1 : -1)) *
              (this.long ? 1 : -1) -
            commission
          const usdRateCurrent = this.usdRate.get(od.symbol.pair) ?? 1
          unrealizedPnL += unPnl
          unrealizedPnLUsd += unPnl * usdRateCurrent
          unrealizedUsage +=
            ((this.combo
              ? this.futures
                ? this.coinm
                  ? od.usage.max.base /* * (this.profitBase ? 1 : tpPrice) */
                  : od.usage.max.quote /* / (this.profitBase ? tpPrice : 1) */
                : this.long
                ? od.usage.max.quote /* / (this.profitBase ? tpPrice : 1) */
                : od.usage.max.base /* * (this.profitBase ? 1 : tpPrice) */
              : this.futures
              ? this.coinm
                ? od.usage.current.base /* * (this.profitBase ? 1 : tpPrice) */
                : od.usage.current.quote /* / (this.profitBase ? tpPrice : 1) */
              : this.long
              ? od.usage.current.quote /*  / (this.profitBase ? tpPrice : 1) */
              : od.usage.current.base) /* * (this.profitBase ? 1 : tpPrice) */ /
              this.leverage) *
            this.getRate()
        }
      }
    }
    const levels = Strategy.deals.map((d) => d.levels.max)
    const maxDealUsage = this.math.round(
      Math.max(Strategy.maxUsage.deal, avgUsable) / this.leverage,
      precision,
    )
    const maxBotUsage = this.math.round(
      Strategy.maxUsage.bot / this.leverage,
      precision,
    )
    const priceDeviation = (orders: FullGrid[]) => {
      const initialOrders = orders
        .filter(
          (io) =>
            io.type === DCAOrderTypeEnum.bo || io.type === DCAOrderTypeEnum.dca,
        )
        .sort((a, b) => a.price - b.price)
      if (initialOrders.length > 1) {
        const [first] = initialOrders
        const [last] = initialOrders.reverse()
        return this.math.round(
          ((last.price - first.price) / last.price) * 100,
          1,
        )
      }
      return 0
    }
    const coveredPriceDeviation = () => {
      if (Strategy.deals.length > 0) {
        return priceDeviation(Strategy.deals[0].initialOrders)
      }
      return 0
    }
    const actualPriceDeviation = () => {
      if (Strategy.deals.length > 0) {
        return priceDeviation(
          Strategy.deals.sort((a, b) => b.levels.max - a.levels.max)[0]
            .filledOrders,
        )
      }
      return 0
    }
    const profitByPeriod: number[] = []
    let periodRatio = 1
    if (workingDays > 3 && closedDeals.length > 0) {
      const dealsByStart = closedDeals.sort((a, b) => a.startTime - b.startTime)
      const [first] = dealsByStart
      const startDate = new Date(first.startTime)
      startDate.setHours(0, 0, 0, 0)
      periodRatio = 365
      if (workingDays - 90 > 0) {
        startDate.setDate(1)
        periodRatio = 12
      }
      for (
        let i = startDate.getTime(), prev = 0;
        prev <= (lastDataItem?.time ?? -1);
        i = startDate.getTime()
      ) {
        const deals = Strategy.deals.filter(
          (d) => d.closedTime && d.closedTime >= prev && d.closedTime < i,
        )

        const profit = deals.reduce((acc, v) => (acc += v.profit.total), 0)
        profitByPeriod.push(profit)
        if (periodRatio === 365) {
          startDate.setHours(24)
        }
        if (periodRatio === 12) {
          startDate.setMonth(startDate.getMonth() + 1)
        }
        prev = i
      }
    }
    const lastPrice = lastDataItem?.close

    const maxTheoreticalUsageValue = this.math.round(
      Math.max(maxTheoreticalUsage, maxDealUsage, maxBotUsage),
      precision,
    )
    const maxTheoreticalUsageWithRate = [
      OrderSizeTypeEnum.percFree,
      OrderSizeTypeEnum.percTotal,
    ].includes(this.settings.orderSizeType)
      ? Strategy.initialBalanceUsd
      : maxTheoreticalUsageValue * this.getRate()
    /* Strategy.deals = Strategy.deals.map((d) => {
      if (!this.combo) {
        d.ordersHistory = d.ordersHistory.filter(
          (oh) =>
            oh.type !== DCAOrderTypeEnum.bo && oh.type !== DCAOrderTypeEnum.dca,
        )
      }
      return d
    }) */
    const confidenceGrade = this.getConfidenceGrade()
    const buyAndHold = this.getBuyAndHold(firstData, lastData)
    const symbolStats: SymbolStats[] = []
    for (const s of this.symbols.keys()) {
      const deals = Strategy.deals.filter((d) => d.symbol.pair === s)
      const maxSymbolValue =
        Math.max(
          ...deals.map(
            (d) =>
              (this.futures
                ? this.coinm
                  ? d.usage.current.base
                  : d.usage.current.quote
                : !this.long
                ? d.usage.current.base
                : d.usage.current.quote) / this.leverage,
          ),
        ) *
        this.getRate() *
        +(this.settings.maxDealsPerPair ?? '1')
      const profitDealsStats = deals.filter(
        (d) => d.profit.total > 0 && d.status === 'closed',
      )
      const lossDealsStats = deals.filter(
        (d) => d.profit.total <= 0 && d.status === 'closed',
      )
      const allProfitStats = profitDealsStats.reduce(
        (acc, d) => (acc += d.profit.total),
        0,
      )
      const allLossStats = lossDealsStats.reduce(
        (acc, d) => (acc += d.profit.total),
        0,
      )
      const closedDealsStats = deals.filter((d) => d.status === 'closed').length
      const profit = Strategy.totalProfitPerSymbol.get(s) ?? 0
      const profitUsd = Strategy.totalProfitUsdPerSymbol.get(s) ?? 0
      const precisionStats = this.precision.get(s) ?? 8
      const symbol = this.symbols.get(s)
      const maxDealDuration = deals.length
        ? friendlyTime(Math.max(...deals.map((cd) => cd.duration)))
        : { d: '', h: '', min: '', s: '' }
      const totalDealsDuration = deals.reduce(
        (acc, d) => (acc += d.duration),
        0,
      )
      const avgDealDuration = deals.length
        ? friendlyTime(this.math.round(totalDealsDuration / deals.length, 0))
        : { d: '', h: '', min: '', s: '' }
      symbolStats.push({
        pair: s,
        deals: {
          profit: profitDealsStats.length,
          loss: lossDealsStats.length,
          open: deals.filter((d) => d.status === 'open').length,
        },
        netProfit: {
          total: this.math.round(profit, precisionStats),
          totalUsd: this.math.round(profitUsd),
          perc:
            maxSymbolValue === 0
              ? 0
              : this.math.round((profitUsd / maxSymbolValue) * 100),
        },
        dailyReturn: {
          total: this.math.round(profit / workingDays, precisionStats),
          totalUsd: this.math.round(profitUsd / workingDays),
          perc:
            maxSymbolValue === 0
              ? 0
              : this.math.round(
                  (profitUsd / workingDays / maxSymbolValue) * 100,
                ),
        },
        profitAsset: this.profitBase
          ? symbol?.baseAsset?.name ?? ''
          : symbol?.quoteAsset?.name ?? '',
        winRate: closedDeals
          ? this.math.round((profitDealsStats.length / closedDealsStats) * 100)
          : 0,
        maxDealDuration,
        avgDealDuration,
        profitFactor:
          allLoss !== 0
            ? `${this.math.round(Math.abs(allProfitStats / allLossStats), 3)}`
            : `${Infinity}`,
      })
    }
    const quoteRate = lastPrice ?? 0
    const maxRealUsage = this.math.round(
      Math.max(maxDealUsage, maxBotUsage / maxNumberOfOpenDeals),
      precision,
    )
    const ratiosRate =
      (this.settings?.futures
        ? this.settings.coinm
          ? quoteRate
          : 1
        : this.settings.strategy === StrategyEnum.long
        ? 1
        : quoteRate) /
      (this.settings.profitCurrency === 'base' || this.settings.coinm
        ? quoteRate
        : 1)
    const ratiosUsage = ratiosRate * maxRealUsage
    const sortino = this.math.santinoRatio(
      profitByPeriod,
      ratiosUsage,
      periodRatio,
    )
    const sharpe = this.math.sharpeRatio(
      profitByPeriod,
      ratiosUsage,
      periodRatio,
    )
    let stDevDownLoss = this.math.downsideStDev(
      lossDeals.map((d) => d.profit.perc),
      2 / periodRatio,
    )
    stDevDownLoss = isNaN(stDevDownLoss) ? 0 : stDevDownLoss
    let stDevLoss = this.math.stDev(lossDeals.map((d) => d.profit.perc))
    stDevLoss = isNaN(stDevLoss) ? 0 : stDevLoss
    const result: DCABacktestingResult = {
      buyAndHoldEquity: buyAndHold?.buyAndHoldEquity ?? [],
      indicatorsEvents: [...Strategy.indicatorEvents],
      symbolStats,
      deals: [...Strategy.deals]
        .sort((a, b) =>
          Strategy.edge
            ? Math.random() > 0.5
              ? -1
              : 1
            : b.startTime - a.startTime,
        )
        .map((d, ind) => ({
          ...d,
          number: ind + 1,
          mingrids: d.mingrids.map((m) => ({
            ...m,
            activeOrders: [],
            filledOrders: [],
          })),
        })),
      maxLeverage: Strategy.deals.filter((d) => !!d.liquidationPrice).length
        ? Math.min(
            ...Array.from(this.symbols.keys()).map(
              (s) => this.getMaxLeverage(s) ?? 1,
            ),
          )
        : 0,
      financial: {
        netProfitTotal: totalProfit,
        netProfitTotalUsd: totalProfitUsd,
        netProfitTotalPerc: this.math.round(
          (totalProfitUsd / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        grossProfit: this.math.round(allProfit, precision),
        grossProfitUsd: this.math.round(allProfitUsd, 2),
        grossProfitPerc: this.math.round(
          (allProfitUsd / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        grossLoss: this.math.round(allLoss, precision),
        grossLossUsd: this.math.round(allLossUsd, 2),
        grossLossPerc: this.math.round(
          (allLossUsd / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        avgGrossProfit:
          profitDeals.length > 0
            ? this.math.round(allProfit / profitDeals.length, precision)
            : 0,
        avgGrossProfitUsd:
          profitDeals.length > 0
            ? this.math.round(allProfitUsd / profitDeals.length, 2)
            : 0,
        avgGrossProfitPerc:
          profitDeals.length > 0
            ? this.math.round(
                (allProfitUsd /
                  profitDeals.length /
                  maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgGrossLoss:
          lossDeals.length > 0
            ? this.math.round(allLoss / lossDeals.length, precision)
            : 0,
        avgGrossLossUsd:
          lossDeals.length > 0
            ? this.math.round(allLossUsd / lossDeals.length, 2)
            : 0,
        avgGrossLossPerc:
          lossDeals.length > 0
            ? this.math.round(
                (allLossUsd / lossDeals.length / maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgNetProfit:
          closedDeals.length > 0
            ? this.math.round(totalProfit / closedDeals.length, precision)
            : 0,
        avgNetProfitUsd:
          closedDeals.length > 0
            ? this.math.round(totalProfitUsd / closedDeals.length, 2)
            : 0,
        avgNetProfitPerc:
          closedDeals.length > 0
            ? this.math.round(
                (totalProfitUsd /
                  closedDeals.length /
                  maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgNetDaily:
          workingDays > 0
            ? this.math.round(totalProfit / workingDays, precision)
            : 0,
        avgNetDailyUsd:
          workingDays > 0
            ? this.math.round(totalProfitUsd / workingDays, 2)
            : 0,
        avgNetDailyPerc:
          workingDays > 0
            ? this.math.round(
                (totalProfitUsd / workingDays / maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        unrealizedPnL: this.math.round(unrealizedPnL, precision),
        unrealizedPnLUsd: this.math.round(unrealizedPnLUsd, 2),
        unrealizedPnLPerc: this.math.round(
          (unrealizedPnLUsd / unrealizedUsage) * 100,
        ),
        maxDealLoss: this.math.round(Strategy.maxLoss, precision),
        maxDealLossPerc: this.math.round(
          (Strategy.maxLossUsd / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        maxDealProfit: this.math.round(Strategy.maxProfit, precision),
        maxDealProfitPerc: this.math.round(
          (Strategy.maxProfitUsd / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        maxDealLossUsd: this.math.round(Strategy.maxLossUsd, 2),
        maxDealProfitUsd: this.math.round(Strategy.maxProfitUsd, 2),
        maxDrawDown: -this.math.round(Strategy.seriesLoss.value, precision),
        maxDrawDownUsd: -this.math.round(Strategy.seriesLoss.valueUsd, 2),
        maxDrawDownPerc: this.math.round(
          Strategy.seriesLoss.perc * 100,
          2,
          false,
          true,
        ),
        maxRunUp: this.math.round(Strategy.seriesWin.value, precision),
        maxRunUpUsd: this.math.round(Strategy.seriesWin.valueUsd, 2),
        maxRunUpPerc: this.math.round(
          Strategy.seriesWin.perc * 100,
          2,
          false,
          true,
        ),
        initialBalanceUsd: this.math.round(Strategy.initialBalanceUsd, 4),
        stDevLosingTrade: stDevLoss,
        stDownDevLosingTrade: stDevDownLoss,
        stDevWinningTrade: stDevProfit,
      },
      noData: !firstData && !lastData,
      duration: {
        avgLosingTrade: avgLossDuration,
        avgWinningTrade: avgProfitDuration,
        maxLosingTrade: maxLossDuration,
        maxWinningTrade: maxProfitDuration,
        avgDealDuration: avgDuration,
        avgSplitDealDuration:
          avgDuration > 0
            ? friendlyTime(avgDuration)
            : { d: '', h: '', min: '', s: '' },
        firstDataTime: Strategy.start || (firstDataItem?.time ?? +new Date()),
        lastDataTime: lastDataItem?.time ?? +new Date(),
        loadingDataTime: this.math.round(loadingTime, 3),
        processingDataTime: this.math.round(
          processingTime +
            (new Date().getTime() - startResultProcessing) / 1000,
          3,
        ),
        botWorkingTime:
          workingTime > 0
            ? friendlyTime(workingTime)
            : { d: '', h: '', min: '', s: '' },
        maxDealDuration:
          Strategy.deals.length > 0
            ? friendlyTime(Math.max(...Strategy.deals.map((cd) => cd.duration)))
            : { d: '', h: '', min: '', s: '' },
        botWorkingTimeNumber: workingTime,
      },
      usage: {
        maxTheoreticalUsage: this.math.round(
          Math.max(
            maxDealUsage,
            maxBotUsage / maxNumberOfOpenDeals,
            maxTheoreticalUsageValue / maxNumberOfOpenDeals,
          ),
          precision,
        ),
        maxRealUsage,
        avgRealUsage: avgUsable,
      },
      numerical: {
        confidenceGrade: confidenceGrade.level,
        dealsForConfidenceGrade: confidenceGrade.number,
        all: Strategy.deals.length,
        profit: profitDeals.length,
        loss: lossDeals.length,
        open: openedDeals.length,
        closed: closedDeals.length,
        maxConsecutiveLosses: Strategy.maxConsecutiveLosses,
        maxConsecutiveWins: Strategy.maxConsecutiveWins,
        maxDCATriggered: Math.max(...levels),
        avgDCATriggered:
          Strategy.deals.length > 0
            ? Math.ceil(
                levels.reduce((acc, v) => (acc += v), 0) /
                  Strategy.deals.length,
              )
            : 0,
        dealsPerDay:
          workingDays > 0
            ? this.math.round(closedDeals.length / workingDays, 1)
            : 0,
        coveredPriceDeviation: Math.max(
          coveredPriceDeviation(),
          actualPriceDeviation(),
        ),
        actualPriceDeviation: actualPriceDeviation(),
        liquidationEvents: Strategy.deals.filter((d) => !!d.liquidationPrice)
          .length,
      },
      ratios: {
        profitFactor:
          allLoss !== 0
            ? this.math.round(Math.abs(allProfit / allLoss), 3)
            : Infinity,
        profitByPeriod,
        buyAndHold: {
          value: this.math.round(buyAndHold?.buyAndHold ?? 0, precisionQuote),
          valueUsd: this.math.round(buyAndHold?.buyAndHoldUsd ?? 0, 2),
          perc: this.math.round(
            ((buyAndHold?.buyAndHold ?? 0) /
              (buyAndHold?.buyAndHoldUsage ?? 1)) *
              100 *
              this.leverage,
            2,
          ),
        },
        periodRatio,
        sharpe: isNaN(sharpe) || !isFinite(sharpe) ? 0 : sharpe,
        sortino: isNaN(sortino) || !isFinite(sharpe) ? 0 : sortino,
      },
      interval: Strategy.interval,
      quoteRate,
      profits: Strategy.profits,
      multi: Strategy.multi,
      multiPairs: Strategy.multi
        ? Array.from(this.symbols.keys()).length
        : undefined,
    }
    Strategy.resetData()
    return result
  }
}
