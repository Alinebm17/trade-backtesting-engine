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
} from '../../types'

export type Bar = BarTV

export type StrategyInput = {
  settings: DCABotSettings
  symbol: Symbols
  userFee: number
  prices: Prices
  interval: ExchangeIntervals
  balances?: Asset[] | null
  slippage?: number
  combo?: boolean
  trades?: boolean
}

export type DataType = {
  bar: Bar[]
  interval: ExchangeIntervals
}

export interface StrategyInterface {
  getOtherIntervals(): { interval: ExchangeIntervals; countBack: number }[]
  loadData(data: DataType[], start?: number): void
  test(updateProgress?: (value: number, text: string) => void): Promise<void>
  startWorkingShift(start: number): void
  processBar(bar: Bar, nextBar?: Bar): Promise<void>
  processTrade(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ): void
  passTradeCandleData?: (
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ) => void
  openDeal(price: number, startTime: number, high: number, low: number): void
  checkDeals(b: Bar, cbClose?: (price: number) => void): void
  checkInRange(price: number, time: number): boolean
  returnResult(
    firstData: Bar,
    lastData: Bar,
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

  protected readonly settings: DCABotSettings

  private readonly botFunctions: DCABotFunctions

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
    filledOrders: (b: Bar) => (o: FullGrid) => boolean
    filledTp: (b: Bar) => (o: FullGrid) => boolean
  }

  static maxProfit = 0

  static maxLoss = 0

  static seriesWin = {
    count: 0,
    value: 0,
    min: 0,
    max: 0,
    perc: 0,
  }

  static seriesLoss = {
    count: 0,
    value: 0,
    min: 0,
    max: 0,
    perc: 0,
  }

  static previousDeal?: Deal

  static maxConsecutiveWins = 0

  static maxConsecutiveLosses = 0

  static totalProfit = 0

  protected math = new MathHelper()

  private symbol: Symbols

  private readonly userFee: number

  private readonly usdRate: number

  private readonly usdRateQuote: number

  private readonly precision: number

  private readonly precisionQuote: number

  private readonly precisionBase: number

  private readonly prices: Prices

  private readonly balances?: Asset[] | null

  static interval: ExchangeIntervals

  static data: DataType[] = []

  private readonly slippage?: number

  static lastOpenedDeal = 0

  static lastClosedDeal = 0

  static lowestInterval?: ExchangeIntervals

  static indicators: Indicator[] = []

  static next = 0

  static transactionIndex = 0

  static minPrice = 0

  static maxPrice = 0

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
    Strategy.seriesWin = {
      count: 0,
      value: 0,
      min: 0,
      max: 0,
      perc: 0,
    }
    Strategy.seriesLoss = {
      count: 0,
      value: 0,
      min: 0,
      max: 0,
      perc: 0,
    }
    Strategy.previousDeal = undefined
    Strategy.maxConsecutiveWins = 0
    Strategy.maxConsecutiveLosses = 0
    Strategy.totalProfit = 0
    Strategy.lastOpenedDeal = 0
    Strategy.lastClosedDeal = 0
    Strategy.lowestInterval = undefined
    Strategy.indicators = []
    Strategy.data = []
    Strategy.next = 0
    Strategy.rangeStatus = false
    Strategy.transactionIndex = 0
    Strategy.minPrice = 0
    Strategy.maxPrice = 0
    Strategy.trades = false
    Strategy.indicatorEvents = []
  }

  static position = Strategy.emptyPositon

  private combo = false

  private usedOrderId: Set<string> = new Set()

  static trades?: boolean

  public _stop = false

  private balance = 0

  private initialBalance = 0

  constructor(input: StrategyInput) {
    const {
      settings,
      userFee,
      symbol,
      prices,
      interval,
      balances,
      slippage,
      combo,
      trades,
    } = input
    Strategy.trades = trades
    this.combo = !!combo
    this.settings = settings
    this.botFunctions = this.combo
      ? new ComboBotFunctions(settings, symbol, userFee, trades)
      : new DCABotFunctions(settings, symbol, userFee)
    this.filterFn = {
      filledOrders: this.long
        ? (b: Bar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.high <= o.price
        : (b: Bar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.low >= o.price,
      filledTp: this.long
        ? (b: Bar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.low >= o.price
        : (b: Bar) => (o: FullGrid) =>
            (b.high >= o.price && b.low <= o.price) || b.high <= o.price,
    }
    this.symbol = symbol
    this.userFee = userFee
    this.usdRate = findUSDRate(
      this.profitBase ? symbol.baseAsset.name : symbol.quoteAsset.name,
      prices,
    )
    this.usdRateQuote = findUSDRate(symbol.quoteAsset.name, prices)
    this.precision =
      this.botFunctions.utils.getPrecision(symbol)[
        this.profitBase ? 'base' : 'quote'
      ] + 3
    this.precisionQuote = this.botFunctions.utils.getPrecision(symbol).quote
    this.precisionBase = this.botFunctions.utils.getPrecision(symbol).base
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

  public startWorkingShift(start: number): void {
    Strategy.workingShift.push({ start })
  }

  public abstract processBar(bar: Bar, nextBar?: Bar): Promise<void>

  public abstract processTrade(
    trade: TradeResponse,
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ): void

  public checkInRange(price: number, time: number) {
    const { maxOpenDeal, minOpenDeal } = this.settings
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

  private checkMaxDeals() {
    const { maxNumberOfOpenDeals } = this.settings
    let result = true
    if (maxNumberOfOpenDeals) {
      const max = +maxNumberOfOpenDeals
      if (!isNaN(max) && max > 0) {
        result = Strategy.deals.filter((d) => d.status === 'open').length < max
      }
    }
    return result
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

  private updatePositionWithOrder(order: DCAGrid) {
    if (this.futures) {
      const margin = order.qty
      const sameDirection =
        (Strategy.position.side === PositionSide.LONG &&
          order.side === BotOrderSideEnum.buy) ||
        (Strategy.position.side === PositionSide.SHORT &&
          order.side === BotOrderSideEnum.sell)
      const liquidationPrice = (entryPrice: number, position: PositionSide) =>
        entryPrice *
        (this.leverage > 1
          ? 1 +
            (1 / this.leverage) * (position === PositionSide.LONG ? -1 : 1) /* *
              (1 + this.userFee * (position === PositionSide.LONG ? 1 : -1)) */
          : position === PositionSide.LONG
          ? this.userFee
          : 1 / this.userFee)

      if (sameDirection || Strategy.position.qty === 0) {
        const entryPrice =
          (Strategy.position.qty * Strategy.position.entryPrice +
            order.qty * order.price) /
          (Strategy.position.qty + order.qty)
        const side = this.long ? PositionSide.LONG : PositionSide.SHORT
        Strategy.position = {
          side,
          qty: Strategy.position.qty + margin,
          entryPrice,
          liquidationPrice: liquidationPrice(entryPrice, side),
        }
      } else {
        const diff = Strategy.position.qty - order.qty
        if (Math.abs(diff) <= Number.EPSILON) {
          Strategy.position = Strategy.emptyPositon
        } else if (diff < 0) {
          const side =
            Strategy.position.side === PositionSide.SHORT
              ? PositionSide.LONG
              : PositionSide.SHORT
          Strategy.position = {
            qty: -diff,
            entryPrice: order.price,
            side,
            liquidationPrice: liquidationPrice(order.price, side),
          }
        } else {
          Strategy.position.qty -= margin
        }
      }
    }
  }

  private generateGridsOnPrice(minigrid: Minigrid, price: number) {
    const { long, settings, symbol } = this
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
      _latestPrice: price,
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
    }
    const grids: DCAGrid[] = this.botFunctions.utils
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
    _initialPrice?: number,
  ) {
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
      initialOrders: [],
      filledOrders: [],
      activeOrders: [],
      id: this.botFunctions.utils.id(20),
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
    if (
      this.settings.useSl &&
      this.settings.dealCloseConditionSL === CloseConditionEnum.tp
    ) {
      if (
        !this.botFunctions.isTrailingSl &&
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
            id: this.botFunctions.utils.id(10),
            startTime: startTime ?? deal.startTime,
            slLine: true,
            dealId: deal.id,
          },
        ]
      }
      if (
        (this.botFunctions.isTrailingSl || this.botFunctions.isTrailingTp) &&
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
            id: this.botFunctions.utils.id(10),
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
          id: this.botFunctions.utils.id(10),
          startTime: startTime ?? deal.startTime,
          slLine: true,
          dealId: deal.id,
        }))
      }
    }
    return []
  }

  private getBalances(): Asset[] | null | undefined {
    if (this.balance === 0) {
      return this.balances
    }

    const asset = this.futures
      ? this.coinm
        ? this.symbol.baseAsset.name
        : this.symbol.quoteAsset.name
      : this.long
      ? this.symbol.quoteAsset.name
      : this.symbol.baseAsset.name
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

  public openDeal(price: number, startTime: number, high: number, low: number) {
    if (!this.checkCooldownStart(startTime)) {
      return
    }
    if (!this.checkCooldownStop(startTime)) {
      return
    }
    if (!this.checkInRange(price, startTime)) {
      return
    }
    if (!this.checkMaxDeals()) {
      return
    }
    Strategy.lastOpenedDeal = startTime
    let orderPrice = this.slippage
      ? price * (1 + ((this.long ? 1 : -1) * this.slippage) / 100)
      : price
    orderPrice = this.math.round(
      orderPrice > high ? high : orderPrice < low ? low : orderPrice,
      this.symbol.priceAssetPrecision,
    )
    let initialOrders = this.botFunctions
      .createOrders(orderPrice, true, undefined, undefined, this.getBalances())
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
    const id = this.botFunctions.utils.id(20)
    const filledOrders = initialOrders
      .filter((o) => o.type === DCAOrderTypeEnum.bo)
      .map((fo) => ({
        ...fo,
        startTime,
        filledTime: startTime,
        dealId: id,
      }))
    const baseOrder = filledOrders[0]
    this.updatePositionWithOrder(baseOrder)
    initialOrders = [
      ...initialOrders.filter((o) => o.type !== DCAOrderTypeEnum.tp),
    ]

    const step = baseOrder.price * (+this.settings.step / 100)
    let deal: Deal = {
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
    }

    if (
      this.settings.useTp &&
      !this.botFunctions.isTrailingTp &&
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
      const minigrid = this.createMinigrid(deal, baseOrder, false)
      deal.mingrids.push(minigrid)
      for (const o of minigrid.activeOrders) {
        activeOrders.push({ ...o, startTime })
      }
      for (const h of hiddenDCA) {
        const m = this.createMinigrid(deal, h, true, baseOrder.price)
        deal.mingrids.push(m)
        for (const o of m.activeOrders) {
          activeOrders.push({ ...o, startTime })
        }
        deal.hiddenOrders.push({
          ...h,
          startTime,
          filledTime: startTime,
          dealId: id,
        })
      }
    }

    const initialBase = this.long
      ? 0
      : allInitialOrder
          .filter(
            (o) =>
              o.type &&
              [DCAOrderTypeEnum.bo, DCAOrderTypeEnum.dca].includes(o.type),
          )
          .reduce((acc, o) => acc + o.qty, 0)
    const initialQuote = this.long
      ? allInitialOrder
          .filter(
            (o) =>
              o.type &&
              [DCAOrderTypeEnum.bo, DCAOrderTypeEnum.dca].includes(o.type),
          )
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

    if (this.botFunctions.isTrailingSl || this.botFunctions.isTrailingTp) {
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

    if (this.balance === 0) {
      this.balance = this.futures
        ? this.coinm
          ? deal.usage.max.base
          : deal.usage.max.quote
        : this.long
        ? deal.usage.max.quote * (this.profitBase ? 1 / deal.startPrice : 1)
        : deal.usage.max.base * (this.profitBase ? 1 : deal.startPrice)
      this.initialBalance = this.balance
    }
  }

  private filterTP(d: Deal, b: Bar): { deal: Deal; order?: FullGrid } {
    if (this.combo) {
      return { deal: d }
    }
    if (this.botFunctions.isTrailingTp) {
      return { deal: d }
    }
    const filledTp = d.activeOrders
      .filter((o) => o.type === DCAOrderTypeEnum.tp)
      .filter(this.filterFn.filledTp(b))
    for (const tp of filledTp) {
      this.updatePositionWithOrder(tp)
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
            this.symbol.quoteAsset.minAmount,
          ) &&
          this.math.lte(d.currentBalance.base, this.symbol.baseAsset.minAmount)
        : this.math.lte(
            d.currentBalance.quote,
            this.symbol.quoteAsset.minAmount,
          ) &&
          this.math.lte(
            d.currentBalance.quote / d.avgPrice,
            this.symbol.baseAsset.minAmount,
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
    d.ordersHistory.push({
      qty: 0,
      price,
      side: BotOrderSideEnum.buy,
      id: this.botFunctions.utils.id(10),
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
    const { symbol, userFee } = this
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
    const prices = this.botFunctions.utils.getPrices({
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
    const grids = this.generateGridsOnPrice(minigrid, topPrice * 2) ?? []
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
    const usdRate = this.usdRateQuote
    profitUsdt = totalQuote * usdRate
    const transaction: BacktestingTransaction = {
      _id: v4(),
      updateTime: filledTime ?? 0,
      side,
      amountBaseBuy: this.math.convertFromExponential(
        this.math.round(amountBaseBuy, this.precisionBase),
        this.precisionBase,
      ),
      amountQuoteBuy: this.math.convertFromExponential(
        this.math.round(amountQuoteBuy, this.precisionQuote),
        this.precisionQuote,
      ),
      amountBaseSell: this.math.convertFromExponential(
        this.math.round(amountBaseSell, this.precisionBase),
        this.precisionBase,
      ),
      amountQuoteSell: this.math.convertFromExponential(
        this.math.round(amountQuoteSell, this.precisionQuote),
        this.precisionQuote,
      ),
      priceSell: this.math.convertFromExponential(
        this.math.round(
          side === BotOrderSideEnum.sell ? price : matchedPrice,
          this.symbol.priceAssetPrecision,
        ),
        this.symbol.priceAssetPrecision,
      ),
      priceBuy: this.math.convertFromExponential(
        this.math.round(
          side === BotOrderSideEnum.buy ? price : matchedPrice,
          this.symbol.priceAssetPrecision,
        ),
        this.symbol.priceAssetPrecision,
      ),
      profit: this.math.convertFromExponential(
        this.math.round(
          this.profitBase ? profitBase - comBase : profitQuote - comQuote,
          this.precision + 3,
        ),
        this.precision + 3,
      ),
      profitUsd: this.math.round(profitUsdt, 2),
      baseAsset: this.symbol.baseAsset.name,
      quoteAsset: this.symbol.quoteAsset.name,
      profitAsset: this.futures
        ? this.coinm
          ? this.symbol.baseAsset.name
          : this.symbol.quoteAsset.name
        : this.profitBase
        ? this.symbol.baseAsset.name
        : this.symbol.quoteAsset.name,
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
    return d
  }

  private processGridOrders(d: Deal, b: Bar) {
    if (!this.combo) {
      return d
    }
    for (const m of d.mingrids.filter((mg) => mg.status === 'open')) {
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
        this.updatePositionWithOrder(o)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
        Strategy.profits.push({ total, totalUsd, time: b.time })
      }
      const lastFilledBuy = filledBuy[filledBuy.length - 1]
      if (lastFilledBuy) {
        const lastPrice = lastFilledBuy.price
        grids = this.generateGridsOnPrice(m, lastPrice)
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
        this.updatePositionWithOrder(o)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
        Strategy.profits.push({ total, totalUsd, time: b.time })
      }
      const lastFilledSell = filledSell[filledSell.length - 1]
      if (lastFilledSell) {
        const lastPrice = lastFilledSell.price
        grids = this.generateGridsOnPrice(m, lastPrice)
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
            return this.closeDeal(d, b)
          }
          if (order) {
            d.activeOrders.push({
              ...order,
              filledTime: undefined,
              id: this.botFunctions.utils.id(20),
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

  addDCAOrder(index: number, price: number, time: number) {
    for (const d of Strategy.deals.filter(
      (dd) => dd.status === 'open' && dd.lastFilled + 1 === index + 1,
    )) {
      if (this.settings.dcaCondition === DCAConditionEnum.indicators) {
        const ind = this.settings.indicators.filter(
          (i) => i.indicatorAction === IndicatorAction.startDca,
        )[index]
        if (ind) {
          const { minPercFromLast } = ind
          if (minPercFromLast && !isNaN(+minPercFromLast)) {
            const diff = this.long ? d.lastPrice - price : price - d.lastPrice
            const absDiff = diff / d.lastPrice

            if (absDiff >= +minPercFromLast / 100) {
              const orders = this.botFunctions.createOrders(
                d.startPrice,
                true,
                undefined,
                [],
                this.getBalances(),
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
                })
              }
            }
          }
        }
      }
    }
  }

  private processDCAOrders(d: Deal, b: Bar) {
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
          const m = this.createMinigrid(d, o, false)
          d.mingrids.push(m)
          for (const ao of m.activeOrders) {
            d.activeOrders.push({ ...ao, startTime: b.time })
          }
        }
        this.updatePositionWithOrder(o)
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

  private getSLOrder(d: Deal, b: Bar): { deal: Deal; order?: FullGrid } {
    if (
      this.settings.dealCloseConditionSL !== CloseConditionEnum.tp &&
      !this.combo
    ) {
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
            this.updatePositionWithOrder(sl)
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
              this.symbol.quoteAsset.minAmount,
            ) &&
            this.math.lte(
              d.currentBalance.base,
              this.symbol.baseAsset.minAmount,
            )
          : this.math.lte(
              d.currentBalance.quote,
              this.symbol.quoteAsset.minAmount,
            ) &&
            this.math.lte(
              d.currentBalance.quote / d.avgPrice,
              this.symbol.baseAsset.minAmount,
            )
        /* const profit = this.getProfit(d)
        if (profit) {
          d.profit = profit
        } */
        return { deal: d, order: allFilled ? lastSl : undefined }
      }
    } else if (
      ((this.botFunctions.isTrailingSl &&
        d.trailingMode === TrailingModeEnum.tsl) ||
        (this.botFunctions.isTrailingTp &&
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
        const qty = this.long
          ? d.currentBalance.base
          : d.initialBalance.base - d.currentBalance.base
        const quote =
          (this.long
            ? d.initialBalance.quote - d.currentBalance.quote
            : d.currentBalance.quote) +
          d.profit.total * (this.long ? 1 : -1)
        const quoteTp = qty * price
        const commission = this.futures
          ? this.coinm
            ? qty * this.userFee
            : qty * price * this.userFee
          : !this.long
          ? qty * this.userFee
          : qty * price * this.userFee
        const unpnl = (quoteTp - quote) * (this.long ? 1 : -1)
        const total = d.profit.total + unpnl - commission
        const denominator = this.futures
          ? this.coinm
            ? d.usage.max.base
            : d.usage.max.quote
          : this.long
          ? d.usage.max.quote
          : d.usage.max.base * d.startPrice
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
      this.updatePositionWithOrder(slOrder)
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

  closeAllDeals(b: Bar) {
    Strategy.deals = Strategy.deals.map((d) => {
      if (d.status === 'open' && this.checkMinTp(b.open, d)) {
        const tp = this.getTP(d, b.open, true, false)[0]
        return this.closeDeal(d, b, tp)
      }
      return d
    })
    Strategy.position = Strategy.emptyPositon
  }

  private closeMinigrid(minigrid: Minigrid): Minigrid {
    return { ...minigrid, status: 'close' }
  }

  private closeDeal(
    d: Deal,
    b: Bar,
    tpOrder?: FullGrid,
    cbClose?: (price: number) => void,
    liquidationPrice?: number,
  ) {
    let closePrice = b.close
    let profit: ReturnType<typeof this.getProfit> | undefined
    d.status = 'closed'
    d.closedTime = b.time
    d.ordersHistory = d.ordersHistory.map((o) =>
      o.filledTime ? { ...o } : { ...o, filledTime: b.time },
    )
    d.duration = d.closedTime - d.startTime
    d.splitDuration = friendlyTime(d.duration)
    d.mingrids = d.mingrids.map((m) => this.closeMinigrid(m))
    d.liquidationPrice = liquidationPrice
    if (tpOrder) {
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
      d.profit.total = this.math.round(d.profit.total, this.precision + 3)
      d.profit.totalUsd = this.math.round(d.profit.totalUsd, 2)
      profit = d.profit
    }

    if (profit) {
      this.balance += profit.total
      if (profit.total > 0 && profit.total > Strategy.maxProfit) {
        Strategy.maxProfit = profit.total
      }
      if (profit.total < 0 && profit.total < Strategy.maxLoss) {
        Strategy.maxLoss = profit.total
      }
      if (!Strategy.previousDeal && profit.total > 0) {
        Strategy.maxConsecutiveWins = 1
        Strategy.seriesWin.value = this.balance - this.initialBalance
        Strategy.seriesWin.min = this.initialBalance
        Strategy.seriesWin.max = this.balance
        Strategy.seriesWin.perc = profit.total / this.balance
      }
      if (!Strategy.previousDeal && profit.total < 0) {
        Strategy.maxConsecutiveLosses = 1
        Strategy.seriesLoss.value = this.initialBalance - this.balance
        Strategy.seriesLoss.min = this.balance
        Strategy.seriesLoss.max = this.initialBalance
        Strategy.seriesLoss.perc = profit.total / this.balance
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
    }
    if (this.balance > Strategy.seriesWin.max) {
      Strategy.seriesWin.max = this.balance
      if (Strategy.seriesWin.min === 0) {
        Strategy.seriesWin.min = Math.min(
          Strategy.seriesLoss.min,
          this.initialBalance,
        )
      }
      const tempValue = Strategy.seriesWin.max - Strategy.seriesWin.min
      if (tempValue > Strategy.seriesWin.value) {
        Strategy.seriesWin.perc = tempValue / Strategy.seriesWin.max
        Strategy.seriesWin.value = tempValue
      }
    }
    if (this.balance < Strategy.seriesWin.min) {
      Strategy.seriesWin.min = this.balance
      Strategy.seriesWin.max = this.balance
    }
    if (this.balance < Strategy.seriesLoss.min) {
      Strategy.seriesLoss.min = this.balance
      if (Strategy.seriesLoss.max === 0) {
        Strategy.seriesLoss.max = Math.max(
          Strategy.seriesWin.max,
          this.initialBalance,
        )
      }
      const tempValue = Strategy.seriesLoss.max - Strategy.seriesLoss.min
      if (tempValue > Strategy.seriesLoss.value) {
        Strategy.seriesLoss.perc = tempValue / Strategy.seriesLoss.max
        Strategy.seriesLoss.value = tempValue
      }
    }
    if (this.balance > Strategy.seriesLoss.max) {
      Strategy.seriesLoss.max = this.balance
      Strategy.seriesLoss.min = this.balance
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

  private getCandleType(b: Bar) {
    return b.close >= b.open ? CandleTypeEnum.bull : CandleTypeEnum.bear
  }

  private checkTrailing(d: Deal, price: number, time: number) {
    if (!(this.botFunctions.isTrailingSl || this.botFunctions.isTrailingTp)) {
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

  private checkPosition(b: Bar) {
    if (!this.futures) {
      return
    }
    const current = Strategy.position
    const long = current.side === PositionSide.LONG
    const price = long ? b.low : b.high
    if (Strategy.minPrice === 0 || Strategy.minPrice > b.low) {
      Strategy.minPrice = b.low
    }
    if (Strategy.maxPrice === 0 || Strategy.maxPrice < b.high) {
      Strategy.maxPrice = b.high
    }
    const close = long
      ? current.liquidationPrice > price
      : current.liquidationPrice < price
    if (close) {
      Strategy.deals = Strategy.deals.map((d) => {
        if (d.status === 'open') {
          const tp = this.getTP(d, current.liquidationPrice, true, false)[0]
          return this.closeDeal(d, b, tp, undefined, current.liquidationPrice)
        }
        return d
      })
      Strategy.position = Strategy.emptyPositon
      if (this.settings.startCondition === StartConditionEnum.asap) {
        this.openDeal(current.liquidationPrice, b.time, b.high, b.low)
      }
    }
  }

  private checkCloseTimer(d: Deal, b: Bar) {
    if (
      this.settings.closeByTimer &&
      this.settings.closeByTimerValue &&
      this.settings.closeByTimerUnits
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
        return this.getTP(d, b.open, true, false)[0]
      }
    }
  }

  public async checkDeals(b: Bar, cbClose?: (price: number) => void) {
    if (this._stop) {
      return
    }
    this.checkPosition(b)
    for (let d of Strategy.deals.filter((dd) => dd.status === 'open')) {
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
            const slReturn = this.getSLOrder(d, b)
            d = slReturn.deal
            if (slReturn.order) {
              tpOrder = slReturn.order
            }
            if (!tpOrder) {
              d = this.processGridOrders(d, b)
              if (d.status === 'closed') {
                return
              }
              d = this.processDCAOrders(d, b)
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
            const slReturn = this.getSLOrder(d, b)
            d = slReturn.deal
            if (slReturn.order) {
              tpOrder = slReturn.order
            }
            if (!tpOrder) {
              d = this.processGridOrders(d, b)
              if (d.status === 'closed') {
                return
              }
              d = this.processDCAOrders(d, b)
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

  private checkValue(b: Bar, d: Deal) {
    if (d.changed) {
      return d
    }
    if (this.botFunctions.isTrailingSl || this.botFunctions.isTrailingTp) {
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
      this.settings.dealCloseConditionSL === CloseConditionEnum.tp
    ) {
      const trigger = +this.settings.moveSLTrigger / 100
      const value = +this.settings.moveSLValue / 100
      if (unPnL / usage - this.userFee * 2 >= trigger) {
        d.changed = true
        d.slPerc = value
        const slOrder = this.getSlHistoryLine(d, b.time)
        d = this.replaceSlHistoryLine(d, slOrder, b.time)
      }
    }
    return d
  }

  private getTP(deal: Deal, _price?: number, aggregate = false, sl = false) {
    const {
      settings: { tpPerc, useMultiTp, multiTp, useMultiSl, multiSl },
      symbol,
    } = this
    const { filledOrders, tpSlTargetFilled, avgPrice } = deal
    const precision = this.botFunctions.utils.getBaseAssetPrecision(symbol)
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
    const quote = this.combo
      ? deal.currentBalance.quote
      : filledRegular.reduce((acc, g) => acc + g.qty * g.price, 0) -
        filledTP.reduce((acc, g) => acc + g.qty * g.price, 0)
    const sellDisplacement = this.userFee * 2
    const priceDisplacement = this.long
      ? 1 + sellDisplacement
      : 1 - sellDisplacement
    const price = (quote / qty) * priceDisplacement
    let tpPrice = this.math.round(
      _price ?? price * (1 + (this.long ? 1 : -1) * (+tpPerc / 100)),
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
    const tpOrder: DCAGrid = {
      qty,
      price: tpPrice,
      type: DCAOrderTypeEnum.tp,
      side: this.long ? BotOrderSideEnum.sell : BotOrderSideEnum.buy,
      id: this.botFunctions.utils.id(20),
    }
    if (tpOrder.price * tpOrder.qty < symbol.quoteAsset.minAmount) {
      tpOrder.qty = this.math.round(
        symbol.quoteAsset.minAmount / tpOrder.price,
        precision,
        false,
        true,
      )
    }
    if (this.profitBase) {
      const newQty = this.math.round((qty * price) / tpOrder.price, precision)
      tpOrder.qty = this.long
        ? Math.min(tpOrder.qty, newQty)
        : Math.max(tpOrder.qty, newQty)
    }
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
          if (qtyTp < symbol.baseAsset.minAmount) {
            qtyTp = symbol.baseAsset.minAmount
          }
          if (priceTp * qtyTp < symbol.quoteAsset.minAmount) {
            qtyTp = symbol.quoteAsset.minAmount / priceTp
          }
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
            id: this.botFunctions.utils.id(20),
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
            id: this.botFunctions.utils.id(20),
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
    const { userFee, usdRate } = this
    const commission = filledOrders
      .filter((o) => (this.combo ? o.type === DCAOrderTypeEnum.tp : true))
      .reduce(
        (acc, v) =>
          (acc += this.profitBase
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
      ? this.long
        ? d.currentBalance.base
        : d.initialBalance.base - d.currentBalance.base
      : regularOrders.reduce((acc, ro) => (acc += ro.qty), 0)
    const tpOrder = filledOrders.filter(
      (fo) =>
        fo.type && [DCAOrderTypeEnum.tp, DCAOrderTypeEnum.sl].includes(fo.type),
    )
    const qty = tpOrder.reduce((acc, tpo) => acc + tpo.qty, 0)
    const quoteTp = tpOrder.reduce((acc, tpo) => acc + tpo.qty * tpo.price, 0)
    const price = quoteTp / qty
    const pureProfit =
      (this.profitBase
        ? base - qty + ((quoteTp - quote) / price) * (this.long ? 1 : -1)
        : quoteTp - quote + (qty - base) * price * (this.long ? 1 : -1)) *
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
      (total / denominator) * 100 * (this.combo ? 1 : this.leverage),
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
      total: this.math.round(total, this.precision, false, true),
      totalUsd: this.math.round(totalUsd, 2),
      perc,
    }
  }

  get long() {
    return this.settings.strategy === StrategyEnum.long
  }

  get profitBase() {
    return (
      (this.futures && this.coinm) || this.settings.profitCurrency === 'base'
    )
  }

  private getRate(quoteRate: number) {
    const denQuote = this.profitBase ? quoteRate : 1
    const numQuote = this.futures
      ? this.coinm
        ? quoteRate
        : 1
      : this.long
      ? 1
      : quoteRate
    return numQuote / denQuote
  }

  private getMaxLeverage() {
    if (!this.futures) {
      return
    }
    const startPrice = this.long ? Strategy.maxPrice : Strategy.minPrice
    const extremum = this.long ? Strategy.minPrice : Strategy.maxPrice
    const dealOrders = this.botFunctions.createOrders(
      startPrice,
      true,
      undefined,
      undefined,
      this.balances,
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

  public returnResult(
    firstData: Bar,
    lastData: Bar,
    loadingTime: number,
    processingTime: number,
  ): DCABacktestingResult {
    const startResultProcessing = new Date().getTime()
    Strategy.deals = Strategy.deals.map((d) => ({
      ...d,
      avgPrice: this.math.round(d.avgPrice, this.symbol.priceAssetPrecision),
      closePrice: d.closePrice
        ? this.math.round(d.closePrice, this.symbol.priceAssetPrecision)
        : d.closePrice,
      startPrice: this.math.round(
        d.startPrice,
        this.symbol.priceAssetPrecision,
      ),
      duration:
        d.status === 'open'
          ? (lastData.time ?? new Date().getTime()) - d.startTime
          : d.duration,
      splitDuration:
        d.status === 'open'
          ? friendlyTime((lastData.time ?? new Date().getTime()) - d.startTime)
          : d.splitDuration,
    }))
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
    const { maxNumberOfOpenDeals } = this.settings
    if (
      maxNumberOfOpenDeals &&
      maxNumberOfOpenDeals !== '' &&
      !isNaN(+maxNumberOfOpenDeals) &&
      +maxNumberOfOpenDeals > 0
    ) {
      maxTheoreticalUsage *= +maxNumberOfOpenDeals
      maxTheoreticalUsage /= this.leverage
    }
    const totalProfit = this.math.round(Strategy.totalProfit, this.precision)
    const totalProfitUsd = this.math.round(
      Strategy.totalProfit * this.usdRate,
      2,
    )
    const totalDuration = Strategy.deals.reduce(
      (acc, d) => (acc += d.duration),
      0,
    )
    const workingTime = Strategy.workingShift.reduce(
      (acc, ws) => (acc += (ws.end || lastData?.time || ws.start) - ws.start),
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
    const allProfit = profitDeals.reduce((acc, d) => (acc += d.profit.total), 0)
    const allProfitUsd =
      profitDeals.reduce((acc, d) => (acc += d.profit.total), 0) * this.usdRate
    const allLoss = lossDeals.reduce((acc, d) => (acc += d.profit.total), 0)
    const allLossUsd =
      lossDeals.reduce((acc, d) => (acc += d.profit.total), 0) * this.usdRate
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
            this.precision,
          )
        : 0
    let unrealizedPnL = 0
    let unrealizedPnLUsd = 0
    let unrealizedUsage = 0

    if (openedDeals.length > 0) {
      for (const od of openedDeals) {
        const price = this.prices.find((p) => p.symbol === this.symbol.pair)
        if (price) {
          const tp = this.getTP(
            od,
            lastData.close ?? price.price,
            true,
            false,
          )[0]
          const { qty, price: tpPrice } = tp
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
              (acc += this.profitBase
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
          unrealizedPnL += unPnl
          unrealizedPnLUsd += unPnl * this.usdRate
          unrealizedUsage +=
            (this.combo
              ? this.futures
                ? this.coinm
                  ? od.usage.max.base * (this.profitBase ? 1 : tpPrice)
                  : od.usage.max.quote / (this.profitBase ? tpPrice : 1)
                : this.long
                ? od.usage.max.quote / (this.profitBase ? tpPrice : 1)
                : od.usage.max.base * (this.profitBase ? 1 : tpPrice)
              : this.futures
              ? this.coinm
                ? od.usage.current.base * (this.profitBase ? 1 : tpPrice)
                : od.usage.current.quote / (this.profitBase ? tpPrice : 1)
              : this.long
              ? od.usage.current.quote / (this.profitBase ? tpPrice : 1)
              : od.usage.current.base * (this.profitBase ? 1 : tpPrice)) /
            this.leverage
        }
      }
    }
    const levels = Strategy.deals.map((d) => d.levels.max)
    const maxDealUsage = this.math.round(
      Math.max(Strategy.maxUsage.deal, avgUsable) / this.leverage,
      this.precision,
    )
    const maxBotUsage = this.math.round(
      Strategy.maxUsage.bot / this.leverage,
      this.precision,
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
        prev <= (lastData?.time ?? -1);
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
    const firstPrice = firstData?.close
    const lastPrice = lastData?.close

    const maxTheoreticalUsageValue = this.math.round(
      Math.max(maxTheoreticalUsage, maxDealUsage, maxBotUsage),
      this.precision,
    )
    const maxTheoreticalUsageWithRate =
      maxTheoreticalUsageValue * this.getRate(lastPrice)
    const buyAndHoldUsage =
      maxTheoreticalUsageWithRate * (this.profitBase ? lastPrice : 1)
    const buyAndHold =
      (firstPrice && lastPrice
        ? (buyAndHoldUsage / firstPrice) * lastPrice - buyAndHoldUsage
        : 0) * this.leverage
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
    const result = {
      indicatorsEvents: [...Strategy.indicatorEvents],
      deals: [...Strategy.deals]
        .sort((a, b) => b.startTime - a.startTime)
        .map((d, ind) => ({ ...d, number: ind + 1 })),
      maxLeverage: Strategy.deals.filter((d) => !!d.liquidationPrice).length
        ? this.getMaxLeverage()
        : 0,
      financial: {
        netProfitTotal: totalProfit,
        netProfitTotalUsd: totalProfitUsd,
        netProfitTotalPerc: this.math.round(
          (totalProfit / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        grossProfit: this.math.round(allProfit, this.precision),
        grossProfitUsd: this.math.round(allProfitUsd, 2),
        grossProfitPerc: this.math.round(
          (allProfit / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        grossLoss: this.math.round(allLoss, this.precision),
        grossLossUsd: this.math.round(allLossUsd, 2),
        grossLossPerc: this.math.round(
          (allLoss / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        avgGrossProfit:
          profitDeals.length > 0
            ? this.math.round(allProfit / profitDeals.length, this.precision)
            : 0,
        avgGrossProfitUsd:
          profitDeals.length > 0
            ? this.math.round(allProfitUsd / profitDeals.length, 2)
            : 0,
        avgGrossProfitPerc:
          profitDeals.length > 0
            ? this.math.round(
                (allProfit / profitDeals.length / maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgGrossLoss:
          lossDeals.length > 0
            ? this.math.round(allLoss / lossDeals.length, this.precision)
            : 0,
        avgGrossLossUsd:
          lossDeals.length > 0
            ? this.math.round(allLossUsd / lossDeals.length, 2)
            : 0,
        avgGrossLossPerc:
          lossDeals.length > 0
            ? this.math.round(
                (allLoss / lossDeals.length / maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgNetProfit:
          closedDeals.length > 0
            ? this.math.round(totalProfit / closedDeals.length, this.precision)
            : 0,
        avgNetProfitUsd:
          closedDeals.length > 0
            ? this.math.round(totalProfitUsd / closedDeals.length, 2)
            : 0,
        avgNetProfitPerc:
          closedDeals.length > 0
            ? this.math.round(
                (totalProfit /
                  closedDeals.length /
                  maxTheoreticalUsageWithRate) *
                  100,
                2,
              )
            : 0,
        avgNetDaily:
          workingDays > 0
            ? this.math.round(totalProfit / workingDays, this.precision)
            : 0,
        avgNetDailyUsd:
          workingDays > 0
            ? this.math.round(totalProfitUsd / workingDays, 2)
            : 0,
        avgNetDailyPerc:
          workingDays > 0
            ? this.math.round(
                (totalProfit / workingDays / maxTheoreticalUsageWithRate) * 100,
                2,
              )
            : 0,
        unrealizedPnL: this.math.round(unrealizedPnL, this.precision),
        unrealizedPnLUsd: this.math.round(unrealizedPnLUsd, 2),
        unrealizedPnLPerc: this.math.round(
          (unrealizedPnL / unrealizedUsage) * 100,
        ),
        maxDealLoss: this.math.round(Strategy.maxLoss, this.precision),
        maxDealLossPerc: this.math.round(
          (Strategy.maxLoss / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        maxDealProfit: this.math.round(Strategy.maxProfit, this.precision),
        maxDealProfitPerc: this.math.round(
          (Strategy.maxProfit / maxTheoreticalUsageWithRate) * 100,
          2,
        ),
        maxDealLossUsd: this.math.round(Strategy.maxLoss * this.usdRate, 2),
        maxDealProfitUsd: this.math.round(Strategy.maxProfit * this.usdRate, 2),
        maxDrawDown: -this.math.round(
          Strategy.seriesLoss.value,
          this.precision,
        ),
        maxDrawDownUsd: -this.math.round(
          Strategy.seriesLoss.value * this.usdRate,
          2,
        ),
        maxDrawDownPerc: this.math.round(Strategy.seriesLoss.perc * 100, 2),
        maxRunUp: this.math.round(Strategy.seriesWin.value, this.precision),
        maxRunUpUsd: this.math.round(
          Strategy.seriesWin.value * this.usdRate,
          2,
        ),
        maxRunUpPerc: this.math.round(Strategy.seriesWin.perc * 100, 2),
      },
      noData: !firstData && !lastData,
      duration: {
        avgDealDuration: avgDuration,
        avgSplitDealDuration:
          avgDuration > 0
            ? friendlyTime(avgDuration)
            : { d: '', h: '', min: '', s: '' },
        firstDataTime: Strategy.start || (firstData?.time ?? +new Date()),
        lastDataTime: lastData?.time ?? +new Date(),
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
      },
      usage: {
        maxTheoreticalUsage: maxTheoreticalUsageValue,
        maxRealUsage: this.math.round(
          Math.max(maxDealUsage, maxBotUsage),
          this.precision,
        ),
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
          value: this.math.round(buyAndHold, this.precisionQuote),
          valueUsd: this.math.round(buyAndHold * this.usdRateQuote, 2),
          perc: this.math.round((buyAndHold / buyAndHoldUsage) * 100, 2),
        },
        periodRatio,
      },
      interval: Strategy.interval,
      quoteRate: lastPrice ?? 0,
      profits: Strategy.profits,
    }
    Strategy.resetData()
    return result
  }
}
