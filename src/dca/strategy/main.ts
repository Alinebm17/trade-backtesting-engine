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
  OrderSizeTypeEnum,
  ComboTpBase,
  CooldownOptionsEnum,
  CloseDCATypeEnum,
  DynamicPriceFilterPriceTypeEnum,
  BotStartTypeEnum,
  DynamicPriceFilterDirectionEnum,
  IndicatorEnum,
  ppValueEnum,
  SRCrossingEnum,
  BBCrossingEnum,
  STConditionEnum,
  RiskSlTypeEnum,
  ScaleDcaTypeEnum,
  IndicatorSection,
  BaseSlOnEnum,
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
  PeriodicStats,
  PreparedDeal,
  ExchangeEnum,
  MAResult,
  DynamicArPrices,
  Sizes,
} from '../../types'
import {
  FasterBandsResult,
  PivotResult,
  PriorPivotResult,
  QFLResult,
  SuperTrendResult,
} from '../../../indicators/src'

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
  fullResult?: boolean
  useFile?: boolean
  exchange: ExchangeEnum
}

export type DataType = {
  bar: FullBar[]
  interval: ExchangeIntervals
}

export interface StrategyInterface {
  getOtherIntervals(): { interval: ExchangeIntervals; countBack: number }[]
  loadData(data: DataType[], start?: number): void
  test(
    start: number,
    end: number,
    updateProgress?: (value: number, text: string) => void,
    total?: number,
  ): Promise<void>
  preTest(): Promise<void>
  startWorkingShift(start: number): void
  processBar(
    checkPortfolio: boolean,
    bar: FullBar,
    interval?: ExchangeIntervals,
  ): Promise<void>
  processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ): void
  passTradeCandleData?: (
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ) => void
  openDeal(
    price: number,
    startTime: number,
    high: number,
    low: number,
    symbol: string,
    onlyReturn?: boolean,
  ): void
  checkDeals(
    checkPortfolio: boolean,
    b: FullBar,
    cbClose?: (price: number) => void,
  ): void
  checkInRange(symbol: string, price: number, time: number): boolean
  returnResult(
    firstData: Map<string, FullBar>,
    lastData: Map<string, FullBar>,
    loadingTime: number,
    processingTime: number,
  ): DCABacktestingResult
  long: boolean
  profitBase: boolean
  stop: boolean
  _start: number
}

enum CandleTypeEnum {
  bull = 'bull',
  bear = 'bear',
}

const fundsWarning =
  'The bot used more funds than allocated, this might not be accurate in live trading. Please check your settings.'

const maxDealsPerResult = 50 * 1000

export abstract class Strategy implements StrategyInterface {
  static combo = false

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

  static messages: string[] = []

  static maxUsage: {
    deal: number
    bot: number
    botQuote: number
  } = {
    deal: 0,
    bot: 0,
    botQuote: 0,
  }

  static dealsBySymbolsStatusId: Map<string, Map<string, Map<string, Deal>>> =
    new Map()

  static profits: Profit[] = []

  private filterFn: {
    filledOrders: (b: FullBar) => (o: FullGrid) => boolean
    filledTp: (b: FullBar) => (o: FullGrid) => boolean
  }

  static maxProfit = {
    asset: 0,
    usd: 0,
    perc: 0,
  }

  static maxLoss = {
    asset: 0,
    usd: 0,
    perc: 0,
  }

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

  static seriesLossE = {
    valueUsd: 0,
    minUsd: 0,
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

  static lastIndex = 0

  static useFile?: boolean

  static portfolio: Map<number, number> = new Map()

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

  static dataMap: Map<ExchangeIntervals, Map<string, FullBar>> = new Map()

  private readonly slippage?: number

  static lastOpenedDeal = 0

  static lastClosedDeal = 0

  static lastOpenedDealPerSymbol: Map<string, number> = new Map()

  static lastClosedDealPerSymbol: Map<string, number> = new Map()

  static lastPricesPerSymbol: Map<string, { avg: number; entry: number }> =
    new Map()

  static lowestInterval?: ExchangeIntervals

  static highestInterval?: ExchangeIntervals

  static indicators: Indicator[] = []

  static next: Map<string, number> = new Map()

  static transactionIndex = 0

  static minPrice: Map<string, number> = new Map()

  static maxPrice: Map<string, number> = new Map()

  static start = 0

  static previousValues = 0

  static previousValuesInAsset = new Map<
    string,
    { base: number; quote: number }
  >()

  static fullResult?: boolean

  static preventOpen = false

  static resetData() {
    Strategy.preventOpen = false
    Strategy.useFile = false
    Strategy.fullResult = false
    Strategy.dataMap = new Map()
    Strategy.previousValuesInAsset = new Map()
    Strategy.previousValues = 0
    Strategy.start = 0
    Strategy.workingShift = []
    Strategy.maxUsage = {
      deal: 0,
      bot: 0,
      botQuote: 0,
    }
    Strategy.profits = []
    Strategy.maxProfit = {
      asset: 0,
      usd: 0,
      perc: 0,
    }
    Strategy.maxLoss = {
      asset: 0,
      usd: 0,
      perc: 0,
    }
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
    Strategy.seriesLossE = {
      valueUsd: 0,
      minUsd: 0,
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
    Strategy.highestInterval = undefined
    Strategy.indicators = []
    Strategy.data = []
    Strategy.next = new Map()
    Strategy.rangeStatus = false
    Strategy.transactionIndex = 0
    Strategy.minPrice = new Map()
    Strategy.maxPrice = new Map()
    Strategy.trades = false
    Strategy.indicatorEvents = []
    Strategy.balance = new Map()
    Strategy.balanceUsd = 0
    Strategy.initialBalance = 0
    Strategy.balanceForProfit = 0
    Strategy.startRate = 0
    Strategy.initialBalanceUsd = 0
    Strategy.position = new Map()
    Strategy.edge = undefined
    Strategy.previousResult = undefined
    Strategy.multi = false
    Strategy.lastIndex = 0
    Strategy.portfolio = new Map()
    Strategy.dealsBySymbolsStatusId = new Map()
    Strategy.lowestDataForBnHSymbol = ''
    Strategy.lowestDataForBnH = new Map()
    Strategy.lastClosedDealPerSymbol = new Map()
    Strategy.lastOpenedDealPerSymbol = new Map()
    Strategy.lastPricesPerSymbol = new Map()
    Strategy.messages = []
  }

  static position: Map<string, typeof Strategy.emptyPositon> = new Map()

  private usedOrderId: Set<string> = new Set()

  static trades?: boolean

  public _stop = false

  static balance: Map<string, number> = new Map()

  static balanceUsd = 0

  static initialBalance = 0

  static balanceForProfit = 0

  static startRate = 0

  static initialBalanceUsd = 0

  static edge?: EdgeBacktestEnum

  static previousResult?: DCABacktestingResult

  static multi = false

  static lowestDataForBnHSymbol = ''

  static lowestDataForBnH: Map<number, FullBar> = new Map()

  constructor(input: StrategyInput) {
    const {
      settings,
      userFee,
      symbols,
      interval,
      balances,
      slippage,
      combo,
      trades,
      edge,
      previousData,
      multi,
      exchange,
    } = input
    let { prices } = input
    if (!combo) {
      Strategy.edge = edge
      Strategy.previousResult = previousData
    }
    Strategy.multi = !!multi
    Strategy.trades = trades
    Strategy.combo = !!combo
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
    prices = prices.filter((p) => (p.exchange ? p.exchange === exchange : true))
    for (const s of symbols) {
      const bu = Strategy.combo
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

  public set _start(value: number) {
    Strategy.start = value
  }

  public loadData(data: DataType[], start?: number): void {
    Strategy.start = start ?? 0
    Strategy.data = data
    Strategy.dataMap = new Map(
      data.map((d) => [
        d.interval,
        new Map(d.bar.map((b) => [`${b.time}@${b.symbol}`, b])),
      ]),
    )
  }

  public getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    return []
  }

  public abstract test(start: number, end: number): Promise<void>

  public abstract preTest(): Promise<void>

  public startWorkingShift(start: number): void {
    Strategy.workingShift.push({ start })
  }

  public abstract processBar(
    checkPortfolio: boolean,
    bar: FullBar,
    interval?: ExchangeIntervals,
  ): Promise<void>

  public abstract processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ): void

  private checkInDynamicRange(symbol: string, price: number): boolean {
    const { settings } = this
    if (
      !settings.useDynamicPriceFilter ||
      !settings.dynamicPriceFilterDeviation ||
      isNaN(+settings.dynamicPriceFilterDeviation) ||
      !isFinite(+settings.dynamicPriceFilterDeviation)
    ) {
      return true
    }
    const lastData = Strategy.lastPricesPerSymbol.get(symbol)
    if (!lastData) {
      return true
    }
    const latestPrice = price
    const referencePrice =
      settings.dynamicPriceFilterPriceType ===
      DynamicPriceFilterPriceTypeEnum.avg
        ? lastData.avg
        : lastData.entry
    const diff =
      settings.dynamicPriceFilterDirection ===
        DynamicPriceFilterDirectionEnum.overAndUnder ||
      !settings.dynamicPriceFilterDirection
        ? Math.abs(latestPrice - referencePrice)
        : settings.dynamicPriceFilterDirection ===
          DynamicPriceFilterDirectionEnum.over
        ? latestPrice - referencePrice
        : referencePrice - latestPrice
    const currentDeviation = (diff / referencePrice) * 100
    return currentDeviation >= Math.abs(+settings.dynamicPriceFilterDeviation)
  }

  public checkInRange(symbol: string, price: number, time: number) {
    const {
      maxOpenDeal,
      minOpenDeal,
      useMulti,
      useStaticPriceFilter,
      useDynamicPriceFilter,
    } = this.settings
    if (useMulti && !useDynamicPriceFilter) {
      return true
    }
    const dynamic = this.checkInDynamicRange(symbol, price)
    let staticResult = true
    if (useStaticPriceFilter) {
      if (maxOpenDeal || minOpenDeal) {
        if (maxOpenDeal && !minOpenDeal) {
          staticResult = price <= +maxOpenDeal
        }
        if (minOpenDeal && !maxOpenDeal) {
          staticResult = price >= +minOpenDeal
        }
        if (maxOpenDeal && minOpenDeal) {
          staticResult = price >= +minOpenDeal && price <= +maxOpenDeal
        }
      }
    }
    const result = dynamic && staticResult
    const last = Strategy.workingShift[Strategy.workingShift.length - 1]
    const notSetRange =
      useDynamicPriceFilter &&
      !useStaticPriceFilter &&
      (dynamic || (!dynamic && Strategy.getDeals('open', symbol).length > 0))
    if (
      !result &&
      Strategy.workingShift.length > 0 &&
      !Strategy.rangeStatus &&
      !notSetRange
    ) {
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

  private setDeal(deal: Deal, status: Deal['status'], symbol: string) {
    if (!symbol) {
      return
    }
    const getBySymbol = Strategy.dealsBySymbolsStatusId.get(symbol)
    if (!getBySymbol) {
      Strategy.dealsBySymbolsStatusId.set(
        symbol,
        new Map().set(status, new Map().set(deal.id, deal)),
      )
      return
    }
    const getDeals = getBySymbol.get(status)
    if (!getDeals) {
      getBySymbol.set(status, new Map().set(deal.id, deal))
      return
    }
    getDeals.set(deal.id, deal)
  }

  static getDeals(status?: Deal['status'], symbol?: string): Deal[] {
    if (!status) {
      const d: Deal[] = []
      if (!symbol) {
        for (const [, k] of Strategy.dealsBySymbolsStatusId.entries()) {
          for (const [, deal] of k.entries()) {
            d.push(...Array.from(deal.values()))
          }
        }
      } else {
        for (const [, deal] of (
          Strategy.dealsBySymbolsStatusId.get(symbol) ??
          new Map<string, Map<string, Deal>>()
        ).entries()) {
          d.push(...Array.from(deal.values()))
        }
      }
      return d
    }
    if (symbol) {
      const getBySymbol = Strategy.dealsBySymbolsStatusId.get(symbol)
      if (!getBySymbol) {
        return []
      }
      const getByStatus = getBySymbol.get(status)
      if (!getByStatus) {
        return []
      }
      return Array.from(getByStatus.values())
    }
    const d: Deal[] = []
    for (const [, k] of Strategy.dealsBySymbolsStatusId.entries()) {
      for (const deal of (k.get(status) ?? new Map<string, Deal>()).values()) {
        d.push(deal)
      }
    }
    return d
  }

  private removeDeal(id: string, status: Deal['status'], symbol: string) {
    const getBySymbol = Strategy.dealsBySymbolsStatusId.get(symbol)
    if (!getBySymbol) {
      return
    }
    const getDeals = getBySymbol.get(status)
    if (!getDeals) {
      return
    }
    getDeals.delete(id)
  }

  private processDealCloseFromMap(deal: Deal) {
    this.removeDeal(deal.id, 'open', deal.symbol.pair)
    this.setDeal(deal, 'closed', deal.symbol.pair)
  }

  private checkMaxDealsPerPair(symbol: string) {
    const { useMulti, maxDealsPerPair } = this.settings
    if (useMulti && maxDealsPerPair && maxDealsPerPair !== '') {
      const max = +maxDealsPerPair
      if (!isNaN(max) && max >= 0) {
        const symbolDealsLength = Strategy.getDeals('open', symbol).length
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
      if (!isNaN(max) && max >= 0) {
        const dealsLength = Strategy.getDeals('open').length
        if (dealsLength < max) {
          if (this.checkMaxDealsPerPair(symbol)) {
            return true
          }
        }
        return false
      }
    }
    return this.checkMaxDealsPerPair(symbol)
  }

  private checkRiskRewardCondition(
    pair: string,
    price: number,
  ): { tp?: number; sl: number; size: number } | null {
    const {
      riskTpRatio,
      riskSlAmountValue,
      riskSlType,
      riskSlAmountPerc,
      riskMaxPositionSize,
      riskMinPositionSize,
      riskUseTpRatio,
      riskMaxSl,
      riskMinSl,
    } = this.settings
    const indicator = Strategy.indicators.find(
      (i) =>
        i.symbol === pair &&
        i.settings.indicatorAction === IndicatorAction.riskReward,
    )
    if (indicator) {
      const [last] = [...indicator.data].sort((a, b) => b.time - a.time)
      if (last) {
        const { type, ppValue, srCrossingValue, bbCrossingValue, stCondition } =
          indicator.settings
        let value = NaN
        if (type === IndicatorEnum.pp) {
          const data = last.value as PriorPivotResult
          if (ppValue === ppValueEnum.anyH) {
            value = isNaN(data.hh) ? data.lh : data.hh
          }
          if (ppValue === ppValueEnum.hh) {
            value = data.all.hh
          }
          if (ppValue === ppValueEnum.lh) {
            value = data.all.lh
          }
          if (ppValue === ppValueEnum.anyL) {
            value = isNaN(data.ll) ? data.hl : data.ll
          }
          if (ppValue === ppValueEnum.hl) {
            value = data.all.hl
          }
          if (ppValue === ppValueEnum.ll) {
            value = data.all.ll
          }
          if (ppValue === ppValueEnum.anySWH) {
            value = isNaN(data.wh) ? data.sh : data.wh
          }
          if (ppValue === ppValueEnum.wh) {
            value = data.all.wh
          }
          if (ppValue === ppValueEnum.sh) {
            value = data.all.sh
          }
          if (ppValue === ppValueEnum.anySWL) {
            value = isNaN(data.wl) ? data.sl : data.wl
          }
          if (ppValue === ppValueEnum.wl) {
            value = data.all.wl
          }
          if (ppValue === ppValueEnum.sl) {
            value = data.all.sl
          }
        }
        if (type === IndicatorEnum.qfl) {
          const data = last.value as QFLResult
          value = data.base
        }
        if (type === IndicatorEnum.sr) {
          const data = last.value as PivotResult
          value =
            srCrossingValue === SRCrossingEnum.resistance ? data.high : data.low
        }
        if (type === IndicatorEnum.bb || type === IndicatorEnum.kc) {
          const data = last.value as {
            result: FasterBandsResult
            price: number
          }
          value =
            bbCrossingValue === BBCrossingEnum.lower
              ? data.result.lower
              : bbCrossingValue === BBCrossingEnum.middle
              ? data.result.middle
              : data.result.upper
        }
        if (type === IndicatorEnum.ma) {
          const data = last.value as MAResult
          value = data.ma
        }
        if (type === IndicatorEnum.st) {
          const data = last.value as SuperTrendResult
          value =
            stCondition === STConditionEnum.down ? data.all.down : data.all.up
        }
        if (type === IndicatorEnum.psar) {
          const data = last.value as { psar: number; price: number }
          value = data.psar
        }
        if (type === IndicatorEnum.atr) {
          const atrMultiplier = +(indicator?.settings.riskAtrMult ?? '1')
          const data = last.value as number
          value = this.long
            ? price - data * atrMultiplier
            : price + data * atrMultiplier
        }
        if (!isNaN(value)) {
          const symbol = this.symbols.get(pair)
          const precisionPrice = symbol?.priceAssetPrecision
          const precisionQuote = this.precisionQuote.get(pair) ?? 8
          const precisionBase = this.precisionBase.get(pair) ?? 8
          let currentRiskSlPrice = this.math.round(value, precisionPrice)
          const minSl =
            typeof riskMinSl !== 'undefined' && `${riskMinSl}` !== 'null'
              ? Math.abs(+riskMinSl) / 100
              : riskSlType === RiskSlTypeEnum.perc && riskSlAmountPerc
              ? Math.abs(+riskSlAmountPerc) / 100
              : null
          const maxSl = riskMaxSl ? Math.abs(+riskMaxSl) / 100 : 1
          let currentSl = Math.abs((currentRiskSlPrice - price) / price)
          if (minSl && currentSl < minSl) {
            currentSl = minSl * -1
          } else if (maxSl && currentSl > maxSl) {
            currentSl = maxSl * -1
          } else {
            currentSl *= -1
          }
          const riskSlPerc = currentSl
          currentRiskSlPrice = this.math.round(
            price * (1 + riskSlPerc * (this.long ? 1 : -1)),
            symbol?.priceAssetPrecision,
          )
          const rewardTpPerc = Math.abs(riskSlPerc) * +(riskTpRatio ?? '1')
          const rewardTpPrice = this.math.round(
            price * (1 + rewardTpPerc * (this.long ? 1 : -1)),
            precisionPrice,
          )
          const riskPrecision = this.futures
            ? this.coinm
              ? precisionBase
              : precisionQuote
            : this.long
            ? precisionQuote
            : precisionBase

          let riskBalance = symbol
            ? +(
                this.getBalances(symbol.pair)?.find(
                  (s) =>
                    s.asset ===
                    (this.futures
                      ? this.coinm
                        ? symbol.baseAsset.name
                        : symbol.quoteAsset.name
                      : this.long
                      ? symbol.quoteAsset.name
                      : symbol.baseAsset.name),
                )?.free || '0'
              )
            : 0

          if ((riskBalance ?? 0) < 0) {
            return null
          }
          if (!riskBalance) {
            riskBalance =
              ((this.futures
                ? this.coinm
                  ? symbol?.baseAsset.minAmount
                  : symbol?.quoteAsset.minAmount
                : this.long
                ? symbol?.quoteAsset.minAmount
                : symbol?.baseAsset.minAmount) ?? 0) * 10
          }
          const riskSize = this.math.round(
            riskSlType === RiskSlTypeEnum.fixed
              ? +(riskSlAmountValue ?? 0)
              : (riskBalance ?? 0) * (+(riskSlAmountPerc ?? '1') / 100),
            riskPrecision + 2,
          )
          const positionSize =
            riskSlPerc >= 0 || riskSize === 0
              ? 0
              : this.math.round(
                  riskSize / Math.abs(riskSlPerc) / this.leverage,
                  riskPrecision,
                )
          if (positionSize <= 0) {
            return null
          }
          let min = +(riskMinPositionSize ?? '0')
          if (min === -1) {
            min = 0
          }
          let max = +(riskMaxPositionSize ?? '0')
          if (max === -1 || max === 0) {
            max = Infinity
          }
          if (positionSize < min || positionSize > max) {
            return null
          }
          if (positionSize > riskBalance) {
            Strategy.messages.push(fundsWarning)
          }
          return {
            size: positionSize,
            sl: currentRiskSlPrice,
            tp: riskUseTpRatio ? rewardTpPrice : undefined,
          }
        }
      }
    }
    return null
  }

  get scaleAr() {
    return (
      (this.settings.dcaCondition === DCAConditionEnum.percentage ||
        !this.settings.dcaCondition) &&
      [ScaleDcaTypeEnum.adr, ScaleDcaTypeEnum.atr].includes(
        this.settings.scaleDcaType ?? ScaleDcaTypeEnum.percentage,
      ) &&
      this.settings.useDca
    )
  }

  get tpAr() {
    return (
      this.settings.dealCloseCondition === CloseConditionEnum.dynamicAr &&
      this.settings.useTp
    )
  }

  get baseSlOn() {
    if (Strategy.combo) {
      return BaseSlOnEnum.avg
    }
    if (this.settings.trailingSl || this.settings.moveSL) {
      return BaseSlOnEnum.avg
    }
    return this.settings.baseSlOn ?? BaseSlOnEnum.avg
  }

  get slAr() {
    return (
      this.settings.dealCloseConditionSL === CloseConditionEnum.dynamicAr &&
      this.settings.useSl
    )
  }

  private getDynamicLevels(pair: string): DynamicArPrices[] {
    if (!this.scaleAr && !this.tpAr && !this.slAr) {
      return []
    }
    const indicators = Strategy.indicators.filter(
      (i) =>
        i.symbol === pair &&
        ((this.scaleAr &&
          i.settings.indicatorAction === IndicatorAction.startDca) ||
          (this.tpAr &&
            i.settings.indicatorAction === IndicatorAction.closeDeal &&
            i.settings.section !== IndicatorSection.sl) ||
          (this.slAr &&
            i.settings.indicatorAction === IndicatorAction.closeDeal &&
            i.settings.section === IndicatorSection.sl)),
    )
    const result: DynamicArPrices[] = []
    for (const i of indicators) {
      if (!i.data || !i.data.length) {
        continue
      }
      const id = i.id.split('@')[0]
      if (!id) {
        continue
      }
      const [last] = [...i.data].sort((a, b) => b.time - a.time)

      result.push({ id, value: last.value as number })
    }
    if (indicators.length !== result.length) {
      return []
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

  private checkCooldownStart(time: number, symbol: string) {
    if (this.settings.cooldownAfterDealStart && this.settings.useCooldown) {
      const cooldownAfterDealStartOption =
        this.settings.cooldownAfterDealStartOption && this.settings.useMulti
          ? this.settings.cooldownAfterDealStartOption
          : CooldownOptionsEnum.bot
      const lastTime =
        cooldownAfterDealStartOption === CooldownOptionsEnum.bot
          ? Strategy.lastOpenedDeal
          : Strategy.lastOpenedDealPerSymbol.get(symbol) ?? 0
      return (
        time - lastTime >=
        this.convertCooldown(
          this.settings.cooldownAfterDealStartInterval,
          this.settings.cooldownAfterDealStartUnits,
        )
      )
    }
    return true
  }

  private checkCooldownStop(time: number, symbol: string) {
    if (this.settings.cooldownAfterDealStop && this.settings.useCooldown) {
      const cooldownAfterDealStartOption =
        this.settings.cooldownAfterDealStopOption && this.settings.useMulti
          ? this.settings.cooldownAfterDealStopOption
          : CooldownOptionsEnum.bot
      return (
        time -
          (cooldownAfterDealStartOption === CooldownOptionsEnum.bot
            ? Strategy.lastClosedDeal
            : Strategy.lastClosedDealPerSymbol.get(symbol) ?? 0) >=
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
    if (!order) {
      return
    }
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
    const feeOrder = settings.futures
      ? undefined
      : typeof settings.feeOrder !== 'undefined' && settings.feeOrder
      ? false
      : undefined
    const grids: DCAGrid[] = botFunctions.utils
      .createGridOrders(gridSettings, true, false, !long, feeOrder, true)
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
    const profitCurrency = settings.futures ? 'quote' : settings.profitCurrency
    const orderFixedIn = settings.futures
      ? settings.coinm
        ? ('quote' as const)
        : ('base' as const)
      : settings.profitCurrency === 'quote'
      ? ('base' as const)
      : ('quote' as const)
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
          (this.baseSlOn === BaseSlOnEnum.avg
            ? deal.avgPrice
            : deal.startPrice) *
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
    if (Strategy.balanceUsd === 0) {
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
    if (+balance.free < 0) {
      Strategy.messages.push(fundsWarning)
    }
    return this.balances
      ? this.balances.filter((b) => b.asset !== asset).concat(balance)
      : [balance]
  }

  private checkCloseAfterX() {
    if (Strategy.edge) {
      return true
    }
    if (
      this.settings.useBotController &&
      (this.settings.botStart === BotStartTypeEnum.webhook ||
        this.settings.botStart === BotStartTypeEnum.manual)
    ) {
      if (this.settings.useCloseAfterX && this.settings.closeAfterX) {
        return Strategy.getDeals('closed').length < +this.settings.closeAfterX
      }
      if (this.settings.useCloseAfterXopen && this.settings.closeAfterXopen) {
        return Strategy.getDeals().length < +this.settings.closeAfterXopen
      }
    }
    return true
  }

  private calculateCompoundReduce(initialOrders: DCAGrid[]): Sizes | null {
    const use =
      [OrderSizeTypeEnum.base, OrderSizeTypeEnum.quote].includes(
        this.settings.orderSizeType,
      ) &&
      ((this.settings.strategy === StrategyEnum.long &&
        this.settings.profitCurrency === 'quote') ||
        (this.settings.strategy === StrategyEnum.short &&
          this.settings.profitCurrency === 'base') ||
        this.settings.futures) &&
      (this.settings.useRiskReduction || this.settings.useReinvest)
    if (!use) {
      return null
    }
    /* const findLastDeal = Strategy.getDeals('closed').sort(
      (a, b) => (b.closedTime ?? 0) - (a.closedTime ?? 0),
    )[0]
    if (!findLastDeal) {
      return null
    }

    if (
      (findLastDeal.profit.totalUsd > 0 && !this.settings.useReinvest) ||
      (findLastDeal.profit.totalUsd < 0 && !this.settings.useRiskReduction)
    ) {
      return null
    } */

    const profit = Strategy.totalProfit

    if (
      (profit > 0 && !this.settings.useReinvest) ||
      (profit < 0 && !this.settings.useRiskReduction)
    ) {
      return null
    }

    let maxDeals = +(this.settings.maxNumberOfOpenDeals ?? '0')
    if (!maxDeals || maxDeals <= 0) {
      if (this.settings.useMulti) {
        const maxDealsPerPair = +(this.settings.maxDealsPerPair ?? '0')
        if (!maxDealsPerPair || maxDealsPerPair <= 0) {
          maxDeals = 1
        } else {
          maxDeals = Math.max(1, maxDealsPerPair * this.settings.pair.length)
        }
      }
    }

    const toUse =
      (profit *
        (this.settings.useReinvest
          ? +(this.settings.reinvestValue ?? '50') / 100
          : +(this.settings.riskReductionValue ?? '50') / 100)) /
      maxDeals

    const orders = initialOrders.filter(
      (o) =>
        o.type && [DCAOrderTypeEnum.bo, DCAOrderTypeEnum.dca].includes(o.type),
    )

    const baseOrder = orders.find((o) => o.type === DCAOrderTypeEnum.bo)

    if (!baseOrder) {
      return null
    }

    const totalOrders = orders.reduce((acc, v) => acc + v.qty, 0)

    const sizes: Sizes = {
      base:
        (baseOrder.qty / totalOrders) *
        (toUse *
          (this.settings.profitCurrency === 'base' ? 1 : 1 / baseOrder.price)),
      dca: orders
        .filter((o) => o.type === DCAOrderTypeEnum.dca)
        .map(
          (o) =>
            (o.qty / totalOrders) *
            (toUse *
              (this.settings.profitCurrency === 'base' ? 1 : 1 / o.price)),
        ),
    }

    return sizes
  }

  public openDeal(
    price: number,
    startTime: number,
    high: number,
    low: number,
    s: string,
    onlyReturn = false,
  ) {
    if (!onlyReturn && Strategy.preventOpen) {
      return
    }
    if (!this.checkCloseAfterX()) {
      return
    }
    if (!this.checkCooldownStart(startTime, s)) {
      return
    }
    if (!this.checkCooldownStop(startTime, s)) {
      return
    }
    if (!this.checkInRange(s, price, startTime)) {
      return
    }
    if (!this.checkMaxDeals(s)) {
      return
    }
    let fixSl = 0
    let fixTp = 0
    let fixSize = 0
    if (this.settings.useRiskReward) {
      const riskReward = this.checkRiskRewardCondition(s, price)
      if (!riskReward) {
        return
      }
      fixSl = riskReward.sl
      fixTp = riskReward.tp ?? 0
      fixSize = riskReward.size
    }
    let dynamicAr: DynamicArPrices[] = []
    if (this.scaleAr || this.tpAr || this.slAr) {
      const dynamic = this.getDynamicLevels(s)
      if (!dynamic.length) {
        return
      }
      dynamicAr = dynamic
    }
    const symbol = this.symbols.get(s)
    const botFunctions = this.botFunctions.get(s)
    if (!symbol || !botFunctions) {
      return
    }
    if (!onlyReturn) {
      Strategy.lastOpenedDeal = startTime
      Strategy.lastOpenedDealPerSymbol.set(s, startTime)
    }
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
        [],
        true,
        fixSl,
        fixTp,
        fixSize,
        dynamicAr,
      )
      .filter(
        (o) =>
          (!this.settings.useRiskReward && !this.slAr
            ? o.type !== DCAOrderTypeEnum.sl
            : true) && o.type !== DCAOrderTypeEnum.grid,
      )
    const sizes = this.calculateCompoundReduce(initialOrders)
    if (sizes) {
      initialOrders = botFunctions
        .createOrders(
          orderPrice,
          true,
          undefined,
          undefined,
          this.getBalances(s),
          true,
          [],
          true,
          fixSl,
          fixTp,
          fixSize,
          dynamicAr,
          sizes,
        )
        .filter(
          (o) =>
            (!this.settings.useRiskReward && !this.slAr
              ? o.type !== DCAOrderTypeEnum.sl
              : true) && o.type !== DCAOrderTypeEnum.grid,
        )
    }
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
    if (!baseOrder) {
      return
    }
    if (!onlyReturn) {
      this.updatePositionWithOrder(baseOrder, s)
    }
    initialOrders =
      this.settings.useRiskReward && this.settings.riskUseTpRatio
        ? initialOrders
        : [...initialOrders.filter((o) => o.type !== DCAOrderTypeEnum.tp)]

    const step = baseOrder.price * (+this.settings.step / 100)
    let deal: Deal = {
      lastIndex: 0,
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
      lastTime: startTime,
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
      equityInAsset: {
        base: 0,
        quote: 0,
      },
      portfolio: {
        base: 0,
        quote: 0,
      },
      dynamicAr,
      sizes: sizes ?? undefined,
    }

    if (
      this.settings.useTp &&
      !botFunctions.isTrailingTp &&
      (this.settings.dealCloseCondition === CloseConditionEnum.tp ||
        this.tpAr) &&
      !Strategy.combo
    ) {
      const tp = this.getTP(deal)
      initialOrders = [...initialOrders, ...tp]
    }

    const activeOrders: FullGrid[] = initialOrders
      .filter((o) => !filledOrders.map((fo) => fo.id).includes(o.id))
      .map((o) => ({ ...o, startTime }))

    if (Strategy.combo) {
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
          .filter(
            (o) =>
              o.type !== DCAOrderTypeEnum.tp && o.type !== DCAOrderTypeEnum.sl,
          )
          .reduce((acc, o) => acc + o.qty, 0)
    const initialQuote = this.long
      ? allInitialOrder
          .filter(
            (o) =>
              o.type !== DCAOrderTypeEnum.tp && o.type !== DCAOrderTypeEnum.sl,
          )
          .reduce((acc, o) => acc + o.qty * o.price, 0)
      : 0
    const currentBase = filledOrders.reduce((acc, o) => acc + o.qty, 0)
    const currentQuote = filledOrders.reduce(
      (acc, o) => acc + o.qty * o.price,
      0,
    )
    const baseUsage =
      filledOrders.reduce((acc, fo) => (acc += fo.qty), 0) +
      hiddenDCA.reduce((acc, fo) => (acc += fo.qty), 0)
    const quoteUsage =
      filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0) +
      hiddenDCA.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
    const maxBase = allInitialOrder
      .filter((io) => io.type !== DCAOrderTypeEnum.tp)
      .reduce((acc, io) => (acc += io.qty), 0)
    const maxQuote = allInitialOrder
      .filter((io) => io.type !== DCAOrderTypeEnum.tp)
      .reduce((acc, io) => (acc += io.qty * io.price), 0)
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
                .length +
              1 +
              hiddenDCA.length
          : 1,
        complete: hiddenDCA.length + 1,
        max: hiddenDCA.length + 1,
      },
      lastFilled: Strategy.combo ? 1 : 0,
      usage: {
        current: {
          base: this.futures
            ? this.coinm
              ? baseUsage
              : 0
            : this.long
            ? 0
            : baseUsage,
          quote: this.futures
            ? this.coinm
              ? 0
              : quoteUsage
            : this.long
            ? quoteUsage
            : 0,
        },
        max: {
          base: this.futures
            ? this.coinm
              ? maxBase
              : 0
            : this.long
            ? 0
            : maxBase,
          quote: this.futures
            ? this.coinm
              ? 0
              : maxQuote
            : this.long
            ? maxQuote
            : 0,
        },
      },
    }
    deal = this.updateDealVolume(deal)

    if (botFunctions.isTrailingSl || botFunctions.isTrailingTp) {
      deal = this.checkTrailing(deal, price, startTime)
    } else {
      if (!Strategy.combo) {
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

    if (!onlyReturn) {
      this.setDeal(deal, 'open', s)
      this.setLastDealPerSymbol(s)
    }
    const key = this.futures
      ? this.coinm
        ? deal.symbol.baseAsset.name
        : deal.symbol.quoteAsset.name
      : this.long
      ? deal.symbol.quoteAsset.name
      : deal.symbol.baseAsset.name
    if (!Strategy.balance.has(key)) {
      const usdRateQuote = this.usdRateQuote.get(s) ?? 1
      const usdRate = this.usdRate.get(s) ?? 1

      let balanceForProfit =
        (this.futures
          ? this.coinm
            ? deal.usage.max.base
            : deal.usage.max.quote
          : this.long
          ? deal.usage.max.quote * (this.profitBase ? 1 / deal.startPrice : 1)
          : deal.usage.max.base * (this.profitBase ? 1 : deal.startPrice)) /
        this.leverage
      let balance =
        (this.futures
          ? this.coinm
            ? deal.usage.max.base
            : deal.usage.max.quote
          : this.long
          ? deal.usage.max.quote
          : deal.usage.max.base) / this.leverage
      const { maxNumberOfOpenDeals, maxDealsPerPair, useMulti } = this.settings
      if (
        maxNumberOfOpenDeals &&
        maxNumberOfOpenDeals !== '' &&
        !isNaN(+maxNumberOfOpenDeals) &&
        +maxNumberOfOpenDeals >= 0 &&
        (Strategy.multi || (!Strategy.multi && !useMulti))
      ) {
        balance *= +maxNumberOfOpenDeals
        balanceForProfit *= +maxNumberOfOpenDeals
      }
      if (
        maxDealsPerPair &&
        maxDealsPerPair !== '' &&
        !isNaN(+maxDealsPerPair) &&
        +maxDealsPerPair >= 0 &&
        !Strategy.multi &&
        useMulti
      ) {
        balance *= +maxDealsPerPair
        balanceForProfit *= +maxDealsPerPair
      }

      Strategy.balance.set(key, balance)
      if (Strategy.balanceUsd === 0) {
        Strategy.balanceUsd =
          balanceForProfit *
          (this.profitBase ? deal.startPrice : 1) *
          (this.profitBase ? usdRateQuote : usdRate)
        Strategy.initialBalance = balanceForProfit
        Strategy.balanceForProfit = balanceForProfit
        Strategy.initialBalanceUsd = Strategy.balanceUsd
      }
      if (Strategy.startRate === 0) {
        Strategy.startRate = deal.startPrice
      }
    }
  }

  private getUsdRate(symbol: string, price: number, type?: 'base' | 'quote') {
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
      [{ symbol, price }, ...this.prices.filter((p) => p.symbol !== symbol)],
    )
  }

  private updateDealVolume(deal: Deal /* , bar: FullBar */) {
    const usdRateQuote =
      /* this.getUsdRate(deal.symbol.pair, bar.close, 'quote') */ this.usdRateQuote.get(
        deal.symbol.pair,
      ) ?? 1
    const usdRate =
      /* this.getUsdRate(deal.symbol.pair, bar.close) */ this.usdRate.get(
        deal.symbol.pair,
      ) ?? 1
    const _usageBase =
      this.comboBasedOn === ComboTpBase.full
        ? deal.usage.max.base
        : deal.usage.current.base
    const _usageQuote =
      this.comboBasedOn === ComboTpBase.full
        ? deal.usage.max.quote
        : deal.usage.current.quote
    const usageBase = Strategy.combo ? _usageBase : deal.usage.current.base
    const usageQuote = Strategy.combo ? _usageQuote : deal.usage.current.quote
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

    const separatePerSymbol =
      !this.futures &&
      ((this.long && this.profitBase) || (!this.long && !this.profitBase))
    const previousAsset = separatePerSymbol ? deal.symbol.pair : 'all'
    const previousValuesInAsset =
      Strategy.previousValuesInAsset.get(previousAsset)
    const previousValuesInAssetBase = previousValuesInAsset?.base || 0
    const previousValuesInAssetQuote = previousValuesInAsset?.quote || 0
    const newPreviousValue = deal.profit.totalUsd + Strategy.previousValues
    deal.equity = this.math.round(
      newPreviousValue + Strategy.initialBalanceUsd,
      3,
    )
    Strategy.previousValues = newPreviousValue
    const newPreviousValueBaseInAsset = this.profitBase
      ? deal.profit.total + previousValuesInAssetBase
      : 0
    const newPreviousValueQuoteInAsset = this.profitBase
      ? 0
      : deal.profit.total + previousValuesInAssetQuote
    const initialBalance = Strategy.initialBalance
    const startRate = Strategy.startRate
    const base = this.math.round(
      newPreviousValueBaseInAsset +
        (this.long && ((this.futures && !this.coinm) || !this.futures)
          ? 0
          : initialBalance / (!this.profitBase ? startRate : 1)),
      this.precisionBase.get(deal.symbol.pair),
    )
    const quote = this.math.round(
      newPreviousValueQuoteInAsset +
        (this.long && ((this.futures && !this.coinm) || !this.futures)
          ? initialBalance * (this.profitBase ? startRate : 1)
          : 0),
      this.precisionQuote.get(deal.symbol.pair),
    )
    Strategy.previousValuesInAsset.set(previousAsset, {
      base: newPreviousValueBaseInAsset,
      quote: newPreviousValueQuoteInAsset,
    })
    deal.equityInAsset = {
      base,
      quote,
    }
    return deal
  }

  private filterTP(d: Deal, b: FullBar): { deal: Deal; order?: FullGrid } {
    if (Strategy.combo) {
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
    const filled = d.filledOrders.reduce(
      (acc, v) => {
        acc.base += v.qty * (v.side === BotOrderSideEnum.buy ? 1 : -1)
        acc.quote +=
          v.qty * v.price * (v.side === BotOrderSideEnum.buy ? -1 : 1)
        return acc
      },
      { base: 0, quote: 0 },
    )
    d.currentBalance.quote = d.initialBalance.quote + filled.quote
    d.currentBalance.base = d.initialBalance.base + filled.base
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
        deal && Strategy.combo
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
    const findDeal = Strategy.getDeals('open', minigrid.symbol.pair).find(
      (d) => d.id === minigrid.dealId,
    )

    if (findDeal) {
      findDeal.transactions.push(transaction)
      this.setDeal(findDeal, 'open', minigrid.symbol.pair)
    }

    return {
      profitBase: profitBase - comBase,
      profitQuote: profitQuote - comQuote,
      profitUsdt,
    }
  }

  private setLastDealPerSymbol(symbol: string, ignoreId?: string) {
    const deal = Strategy.getDeals('open', symbol)
      .filter((d) => (ignoreId ? d.id !== ignoreId : true))
      .sort((a, b) => b.startTime - a.startTime)[0]
    if (deal) {
      Strategy.lastPricesPerSymbol.set(symbol, {
        avg: deal.avgPrice,
        entry: deal.startPrice,
      })
    } else {
      Strategy.lastPricesPerSymbol.delete(symbol)
    }
  }

  private updateDeal(d: Deal, b: FullBar, usage = true) {
    d = this.updateDealBalances(d)
    if (usage) {
      d = this.updateDealUsage(d)
    }
    d = this.updateDealAvgPrice(d, b.time)
    d = this.updateDealDuration(d, b)
    d = this.updateDealVolume(d)
    this.setLastDealPerSymbol(b.symbol)
    return d
  }

  private processGridOrders(
    d: Deal,
    b: FullBar,
  ): { deal: Deal; closePrice: number; tpOrder?: FullGrid } {
    if (!Strategy.combo) {
      return { deal: d, closePrice: 0 }
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
      let tpOrder: FullGrid | undefined
      for (const o of filledBuy) {
        if (tpOrder) {
          continue
        }
        o.filledTime = b.time
        m.filledOrders.push(o)
        d.filledOrders.push({ ...o, dealId: d.id })
        this.updatePositionWithOrder(o, b.symbol)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
        d = this.updateDealBalances(d)
        const closeOrder = this.getSLOrder(d, b)
        if (closeOrder.order) {
          tpOrder = closeOrder.order
        }
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
        if (tpOrder) {
          continue
        }
        o.filledTime = b.time
        m.filledOrders.push(o)
        d.filledOrders.push({ ...o, dealId: d.id })
        this.updatePositionWithOrder(o, b.symbol)
        m.avgPrice = this.avgPrice(undefined, m)
        const profit = this.createTransaction(o, m)
        total += this.profitBase ? profit.profitBase : profit.profitQuote
        totalUsd += profit.profitUsdt
        d = this.updateDealBalances(d)
        const closeOrder = this.getSLOrder(d, b)
        if (closeOrder.order) {
          tpOrder = closeOrder.order
        }
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
        d = this.updateDeal(d, b, false)
        if (tpOrder) {
          return this.closeDeal(d, b, tpOrder)
        }
        if (closed) {
          const order =
            d.filledOrders.find((o) => o.id === m.dcaOrderId) ??
            d.hiddenOrders.find((o) => o.id === m.dcaOrderId)
          if (order?.type === DCAOrderTypeEnum.bo) {
            return {
              ...this.closeDeal(
                d,
                b,
                this.getTP(
                  d,
                  lastFilledSell?.price ?? lastFilledBuy?.price ?? b.close,
                )[0],
              ),
              closePrice:
                lastFilledSell?.price ?? lastFilledBuy?.price ?? b.close,
            }
          }
          if (order) {
            d = this.updateDealUsage(d)
            d = this.updateDealVolume(d)
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
    return { deal: d, closePrice: 0 }
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
    for (const d of Strategy.getDeals('open', symbol).filter(
      (dd) => dd.lastFilled + 1 === index + 1,
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
        d.lastFilled = Strategy.combo
          ? o.levelNumber
            ? o.levelNumber + 1
            : d.lastFilled
          : o.levelNumber ?? d.lastFilled
        if (Strategy.combo) {
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
        d.lastTime = o.filledTime
      }
      d.filledOrders = [...d.filledOrders, ...filledDCA].map((o) => ({
        ...o,
        dealId: d.id,
      }))
      d = this.updateDeal(d, b)
      if (
        this.settings.useTp &&
        (this.settings.dealCloseCondition === CloseConditionEnum.tp ||
          this.tpAr) &&
        !Strategy.combo
      ) {
        const tpOrdersCurrent = this.getTP(d)
        d.activeOrders = [
          ...d.activeOrders.filter(this.filterTpOrders()),
          ...tpOrdersCurrent,
        ]
      }
      d.levels.max = Math.max(d.lastFilled, d.levels.max)
      d.levels.complete = Strategy.combo
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
      if (!Strategy.combo) {
        const slLine = this.getSlHistoryLine(d, b.time)
        d = this.replaceSlHistoryLine(d, slLine, b.time)
      }
    }
    return d
  }

  get comboBasedOn() {
    return this.settings.comboTpBase &&
      !this.settings.useTp &&
      !this.settings.useSl
      ? ComboTpBase.filled
      : !this.settings.comboTpBase ||
        this.settings.comboTpBase === ComboTpBase.full
      ? ComboTpBase.full
      : ComboTpBase.filled
  }

  private getSLOrder(d: Deal, b: FullBar): { deal: Deal; order?: FullGrid } {
    if (
      this.settings.dealCloseConditionSL !== CloseConditionEnum.tp &&
      !this.slAr &&
      !this.settings.useRiskReward &&
      !Strategy.combo &&
      !d.moveSlActivated
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
    let slOrder: FullGrid | undefined
    let lock = false
    if (
      this.settings.useMultiSl &&
      this.settings.multiSl &&
      this.settings.multiSl.length > 0 &&
      !Strategy.combo &&
      this.settings.dealCloseConditionSL === CloseConditionEnum.tp
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
      !Strategy.combo
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
        (this.settings.moveSL && d.moveSlActivated)) &&
      !Strategy.combo
    ) {
      const sl = d.slPerc
      const refPrice =
        this.baseSlOn === BaseSlOnEnum.avg ? d.avgPrice : d.startPrice
      const diff = this.long ? b.low - refPrice : refPrice - b.high
      if (diff / refPrice - this.userFee * 2 <= sl) {
        close = true
        closePrice = refPrice * (this.long ? 1 - -sl : 1 + -sl)
      }
    } else if (this.settings.useRiskReward && !Strategy.combo) {
      const order = d.activeOrders.find((o) => o.type === DCAOrderTypeEnum.sl)
      if (order) {
        close = this.long
          ? order.price >= Math.min(b.low, b.close, b.open)
          : order.price <= Math.max(b.high, b.close, b.open)
        if (close) {
          closePrice = order.price
          slOrder = order
          lock = true
        }
      }
    } else if (this.slAr) {
      const order = this.getTP(d, undefined, true, true)[0]
      if (order) {
        close = this.long
          ? order.price >= Math.min(b.low, b.close, b.open)
          : order.price <= Math.max(b.high, b.close, b.open)
        if (close) {
          closePrice = order.price
          slOrder = order
          lock = true
        }
      }
    } else if (Strategy.combo) {
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
          this.long
            ? d.currentBalance.base
            : d.initialBalance.base - d.currentBalance.base,
          0,
        )
        const quote = this.long
          ? d.initialBalance.quote - d.currentBalance.quote
          : d.currentBalance.quote
        const quoteTp = qty * price
        const base = quote / price
        const commission = this.profitBase
          ? qty * this.userFee
          : qty * price * this.userFee
        const total =
          (this.profitBase ? qty - base : quoteTp - quote) *
            (this.long ? 1 : -1) -
          commission
        const usageBase =
          this.comboBasedOn === ComboTpBase.full
            ? d.usage.max.base
            : d.usage.current.base
        const usageQuote =
          this.comboBasedOn === ComboTpBase.full
            ? d.usage.max.quote
            : d.usage.current.quote
        const denominator =
          (this.futures
            ? this.coinm
              ? usageBase
              : usageQuote
            : this.long
            ? usageQuote * (this.profitBase ? 1 / price : 1)
            : usageBase * (this.profitBase ? 1 : price)) / this.leverage
        const perc = total / denominator
        if (
          isFinite(Math.abs(perc)) &&
          !isNaN(perc) &&
          !isNaN(this.math.round(perc * 100)) &&
          useSl &&
          slPerc >= perc * 100
        ) {
          close = true
          const requiredPrice = this.profitBase
            ? -(quote * (this.long ? 1 : -1)) /
              (denominator * (slPerc / 100) +
                commission -
                qty * (this.long ? 1 : -1))
            : (denominator * (slPerc / 100) +
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
          const requiredPrice = this.profitBase
            ? -(quote * (this.long ? 1 : -1)) /
              (denominator * (tpPerc / 100) +
                commission -
                qty * (this.long ? 1 : -1))
            : (denominator * (tpPerc / 100) +
                commission +
                quote * (this.long ? 1 : -1)) /
              (qty * (this.long ? 1 : -1))
          closePrice = requiredPrice
        }

        /* if (close) {
          console.log(
            b,
            'sl order',
            qty,
            'base',
            base,
            'qty',
            quoteTp,
            'qtp',
            quote,
            'q',
            d.profit.total,
            'deal',
            perc,
            'perc',
            total,
            'total',
            denominator,
            'deno',
            commission,
            'fee',
            closePrice,
            'close price',
          )
        } */
      }
    }
    if (close) {
      slOrder =
        lock && slOrder
          ? slOrder
          : this.getTP(
              d,
              Strategy.combo && this.profitBase ? b.close : undefined,
              false,
              true,
            )[0]
      slOrder.price = lock
        ? closePrice
        : closePrice *
          (Strategy.combo || (d.trailingLevel && d.trailingMode)
            ? 1
            : this.long
            ? 1 + this.userFee * 2
            : 1 - this.userFee * 2)
      const min = Math.min(b.low, b.close, b.open)
      const max = Math.max(b.high, b.close, b.open)
      slOrder.price = lock
        ? closePrice
        : slOrder.price >= min && slOrder.price <= max
        ? slOrder.price
        : slOrder.price >= max
        ? max
        : slOrder.price <= min
        ? min
        : min
      if (Strategy.combo && this.profitBase) {
        slOrder = this.getTP(d, slOrder.price, false, true)[0]
      }
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

  closeAllDeals(b: FullBar, sl = false, ignoreTp = false) {
    const allDeals = Strategy.getDeals('open', b.symbol).filter(
      (d) => (!sl && this.checkMinTp(b.open, d)) || sl,
    )
    for (const d of allDeals) {
      const position = Strategy.emptyPositon
      Strategy.position.set(b.symbol, position)
      const tp = ignoreTp ? undefined : this.getTP(d, b.open, true, false)[0]
      this.closeDeal(d, b, tp)
      this.processDealCloseFromMap(d)
    }
  }

  stopByIndicator(b: FullBar) {
    Strategy.preventOpen = true
    const action = this.settings.stopType || CloseDCATypeEnum.closeByMarket
    if (
      action === CloseDCATypeEnum.closeByMarket ||
      action === CloseDCATypeEnum.closeByLimit
    ) {
      return this.closeAllDeals(b, true)
    }
    if (action === CloseDCATypeEnum.cancel) {
      this.closeAllDeals(b, true, true)
    }
  }

  private closeMinigrid(minigrid: Minigrid): Minigrid {
    return { ...minigrid, status: 'close' }
  }

  private closeDeal(
    d: Deal,
    b: FullBar,
    tpOrder?: FullGrid,
    liquidationPrice?: number,
  ): { deal: Deal; closePrice: number } {
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
    d.lastIndex = Strategy.lastIndex
    Strategy.lastIndex++
    if (tpOrder && tpOrder.qty > 0) {
      const { price } = tpOrder
      closePrice = price
      d.closePrice = price
      d.lastPrice = price
      d.lastTime = tpOrder.filledTime ?? b.time
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
      const usageBase =
        this.comboBasedOn === ComboTpBase.full
          ? d.usage.max.base
          : d.usage.current.base
      const usageQuote =
        this.comboBasedOn === ComboTpBase.full
          ? d.usage.max.quote
          : d.usage.current.quote
      const denominator =
        (this.futures
          ? this.coinm
            ? usageBase
            : usageQuote
          : this.long
          ? usageQuote * (this.profitBase ? 1 / d.lastPrice : 1)
          : usageBase * (this.profitBase ? 1 : d.lastPrice)) / this.leverage
      d.profit.perc = this.math.round((d.profit.total / denominator) * 100, 2)
      const precision = this.precision.get(d.symbol.pair) ?? 8
      d.profit.total = this.math.round(d.profit.total, precision + 3)
      d.profit.totalUsd = this.math.round(d.profit.totalUsd, 2)
      profit = d.profit
    }
    d = this.updateDealEquity(d)
    const key = this.profitBase
      ? d.symbol.baseAsset.name
      : d.symbol.quoteAsset.name
    let balance = Strategy.balanceForProfit
    const initialBalance = Strategy.initialBalance
    if (profit) {
      Strategy.balance.set(key, (Strategy.balance.get(key) ?? 0) + profit.total)
      Strategy.balanceForProfit += profit.total
      balance = Strategy.balanceForProfit
      Strategy.balanceUsd += profit.totalUsd
      if (profit.total > 0 && profit.total > Strategy.maxProfit.asset) {
        Strategy.maxProfit.asset = profit.total
        Strategy.maxProfit.usd = profit.totalUsd
        Strategy.maxProfit.perc = profit.perc
      }
      if (profit.total < 0 && profit.total < Strategy.maxLoss.asset) {
        Strategy.maxLoss.asset = profit.total
        Strategy.maxLoss.usd = profit.totalUsd
        Strategy.maxLoss.perc = profit.perc
      }
      /* if (profit.totalUsd > 0 && profit.totalUsd > Strategy.maxProfitUsd) {
        Strategy.maxProfitUsd = profit.totalUsd
      }
      if (profit.totalUsd < 0 && profit.totalUsd < Strategy.maxLossUsd) {
        Strategy.maxLossUsd = profit.totalUsd
      } */
      if (!Strategy.previousDeal && profit.total > 0) {
        Strategy.maxConsecutiveWins = 1
        Strategy.seriesWin.value = balance - initialBalance
        Strategy.seriesWin.valueUsd =
          Strategy.balanceUsd - Strategy.initialBalanceUsd
        Strategy.seriesWin.min = initialBalance
        Strategy.seriesWin.max = balance
        Strategy.seriesWin.minUsd = Strategy.initialBalanceUsd
        Strategy.seriesWin.maxUsd = Strategy.balanceUsd
        Strategy.seriesWin.perc = profit.totalUsd / Strategy.balanceUsd
      }
      if (!Strategy.previousDeal && profit.total < 0) {
        Strategy.maxConsecutiveLosses = 1
        Strategy.seriesLoss.value = initialBalance - balance
        Strategy.seriesLoss.valueUsd =
          Strategy.initialBalanceUsd - Strategy.balanceUsd
        Strategy.seriesLoss.min = balance
        Strategy.seriesLoss.max = initialBalance
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
      Strategy.seriesWin.max = balance
      if (Strategy.seriesWin.min === 0) {
        Strategy.seriesWin.min =
          Strategy.seriesLoss.min === 0
            ? initialBalance
            : Math.min(Strategy.seriesLoss.min, initialBalance)
        Strategy.seriesWin.minUsd =
          Strategy.seriesLoss.minUsd === 0
            ? Strategy.initialBalanceUsd
            : Math.min(Strategy.seriesLoss.minUsd, Strategy.initialBalanceUsd)
      }
      const tempValueUsd = Strategy.seriesWin.maxUsd - Strategy.seriesWin.minUsd
      if (tempValueUsd > Strategy.seriesWin.valueUsd) {
        Strategy.seriesWin.perc = Math.abs(
          tempValueUsd / Strategy.seriesWin.minUsd,
        )
        Strategy.seriesWin.valueUsd = tempValueUsd
        Strategy.seriesWin.value =
          Strategy.seriesWin.max - Strategy.seriesWin.min
      }
    }
    if (Strategy.balanceUsd < Strategy.seriesWin.minUsd) {
      Strategy.seriesWin.min = balance
      Strategy.seriesWin.max = balance
      Strategy.seriesWin.minUsd = Strategy.balanceUsd
      Strategy.seriesWin.maxUsd = Strategy.balanceUsd
    }
    if (Strategy.balanceUsd < Strategy.seriesLoss.minUsd) {
      Strategy.seriesLoss.min = balance
      Strategy.seriesLoss.minUsd = Strategy.balanceUsd
      if (Strategy.seriesLoss.max === 0) {
        Strategy.seriesLoss.max =
          Strategy.seriesWin.max === 0
            ? initialBalance
            : Math.max(Strategy.seriesWin.max, initialBalance)
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
      Strategy.seriesLoss.max = balance
      Strategy.seriesLoss.min = balance
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
    Strategy.lastClosedDealPerSymbol.set(d.symbol.pair, b.time)
    this.setLastDealPerSymbol(d.symbol.pair, d.id)
    return { deal: d, closePrice }
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
    if (newTrailingLevel !== d.trailingLevel && !Strategy.combo) {
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
      const allDeals = Strategy.getDeals('open', b.symbol)
      for (const d of allDeals) {
        const tp = this.getTP(d, current.liquidationPrice, true, false)[0]
        this.closeDeal(d, b, tp, current.liquidationPrice)
        this.processDealCloseFromMap(d)
      }
      current = Strategy.emptyPositon
      Strategy.position.set(b.symbol, current)
      if (this.settings.startCondition === StartConditionEnum.asap) {
        this.openDeal(current.liquidationPrice, b.time, b.high, b.low, b.symbol)
      }
    }
  }

  private checkCloseTimer(d: Deal, b: FullBar) {
    if (
      this.settings.closeByTimer &&
      this.settings.closeByTimerUnits &&
      this.settings.useTp
    ) {
      const closeTime =
        d.startTime +
        (this.settings.closeByTimerValue ?? 1) *
          (this.settings.closeByTimerUnits === CooldownUnits.seconds
            ? 1000
            : this.settings.closeByTimerUnits === CooldownUnits.minutes
            ? 60 * 1000
            : this.settings.closeByTimerUnits === CooldownUnits.hours
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000)
      if (closeTime <= b.time) {
        const order = this.getTP(d, b.open, true, false, closeTime)[0]
        this.updatePositionWithOrder(order, b.symbol)
        return order
      }
    }
  }

  private replacePortfolioValue(time: number, val: number, shared: number) {
    const current = Strategy.portfolio.get(time)
    if (current) {
      return Strategy.portfolio.set(time, current + val - shared)
    }
    return Strategy.portfolio.set(time, val)
  }

  public checkPortfolio(time: number, _price: number, symbol: string) {
    const openDeal = Strategy.getDeals('open', symbol)
    const fullSymbol = this.symbols.get(symbol)
    const baseBalance =
      Strategy.balance.get(fullSymbol?.baseAsset.name ?? '') ?? 0
    const quoteBalance =
      Strategy.balance.get(fullSymbol?.quoteAsset.name ?? '') ?? 0
    const baseRate = this.getUsdRate(symbol, _price, 'base')
    const quoteRate = this.getUsdRate(symbol, _price, 'quote')
    const baseUsd = baseBalance * baseRate
    const quoteUsd = quoteBalance * quoteRate
    const rate = this.profitBase ? baseRate : quoteRate
    const balanceUsd = this.math.round(baseUsd + quoteUsd)
    const shared = this.long ? quoteUsd : baseUsd
    if (!this.futures && !openDeal.length) {
      return this.replacePortfolioValue(time, balanceUsd, shared)
    }
    let value = 0
    if (!this.futures) {
      for (const o of openDeal) {
        const price = _price
        const tp = this.getTP(o, price, true, false)[0]
        const { price: tpPrice } = tp
        const qty = tp?.qty ?? 0
        if (qty === 0) {
          continue
        }
        const filledOrders = o.filledOrders.filter(
          (fo) =>
            fo.type &&
            [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(fo.type),
        )
        const filledTPOrders = o.filledOrders.filter(
          (fo) =>
            fo.type &&
            [DCAOrderTypeEnum.tp, DCAOrderTypeEnum.sl].includes(fo.type),
        )
        const quote = Strategy.combo
          ? (this.long
              ? o.initialBalance.quote - o.currentBalance.quote
              : o.currentBalance.quote) +
            (this.profitBase ? 0 : o.profit.total * (this.long ? 1 : -1))
          : filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0) -
            filledTPOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
        const base = Strategy.combo
          ? this.long
            ? o.currentBalance.base
            : o.initialBalance.base - o.currentBalance.base
          : filledOrders.reduce((acc, fo) => (acc += fo.qty), 0) -
            filledTPOrders.reduce((acc, fo) => (acc += fo.qty), 0)
        const comboBase =
          quote / tpPrice +
          (this.profitBase ? o.profit.total * (this.long ? 1 : -1) : 0)
        const quoteTp = qty * tpPrice
        const commission = Strategy.combo
          ? this.profitBase
            ? qty * this.userFee
            : qty * tpPrice * this.userFee
          : o.filledOrders.reduce(
              (acc, v) =>
                (acc += this.profitBase
                  ? v.qty * this.userFee
                  : v.qty * v.price * this.userFee),
              0,
            )
        const unPnl =
          o.profit.total +
          (Strategy.combo
            ? (this.profitBase ? base - comboBase : quoteTp - quote) *
              (this.long ? 1 : -1)
            : (this.profitBase
                ? base -
                  qty +
                  ((qty * tpPrice - quote) / tpPrice) * (this.long ? 1 : -1)
                : qty * tpPrice -
                  quote +
                  (qty - base) * tpPrice * (this.long ? 1 : -1)) *
              (this.long ? 1 : -1)) -
          commission
        value += unPnl * rate
      }
      return this.replacePortfolioValue(
        time,
        this.math.round(value + balanceUsd),
        shared,
      )
    }
    for (const o of openDeal) {
      const price = _price
      const position = Strategy.position.get(o.symbol.pair)
      if (position) {
        const unPnL =
          (position?.side === PositionSide.LONG
            ? price * position.qty - position.entryPrice * position.qty
            : position.entryPrice * position.qty - price * position.qty) *
          quoteRate
        value += unPnL
      }
    }
    return this.replacePortfolioValue(
      time,
      this.math.round(value + balanceUsd),
      this.coinm ? baseUsd : quoteUsd,
    )
  }

  private checkEquityDrawdown() {
    const array = Array.from(Strategy.portfolio, (v) => ({ x: v[0], y: v[1] }))
    const last = array[Strategy.portfolio.size - 1]
    const secondToLast = array[Strategy.portfolio.size - 2]
    if (!last) {
      return
    }
    if (!secondToLast) {
      return (Strategy.seriesLossE = {
        valueUsd: 0,
        minUsd: last.y,
        maxUsd: last.y,
        perc: 0,
      })
    }
    if (last.y === secondToLast.y) {
      return
    }
    if (last.y > Strategy.seriesLossE.maxUsd) {
      return (Strategy.seriesLossE = {
        ...Strategy.seriesLossE,
        minUsd: last.y,
        maxUsd: last.y,
      })
    }
    if (last.y < Strategy.seriesLossE.maxUsd) {
      const tempValue = Strategy.seriesLossE.maxUsd - last.y
      if (tempValue > Strategy.seriesLossE.valueUsd) {
        Strategy.seriesLossE = {
          ...Strategy.seriesLossE,
          valueUsd: tempValue,
          minUsd: last.y,
          perc: tempValue / Strategy.seriesLossE.maxUsd,
        }
      }
    }
  }

  public async checkDeals(
    checkPortfolio: boolean,
    b: FullBar,
    cbClose?: (price: number) => void,
  ) {
    if (this._stop) {
      return
    }
    if (!Strategy.lowestDataForBnHSymbol) {
      Strategy.lowestDataForBnHSymbol = b.symbol
    }
    if (b.symbol === Strategy.lowestDataForBnHSymbol) {
      Strategy.lowestDataForBnH.set(b.time, b)
    }
    const fullSymbol = this.symbols.get(b.symbol)
    if (fullSymbol) {
      const key = this.futures
        ? this.coinm
          ? fullSymbol.baseAsset.name
          : fullSymbol.quoteAsset.name
        : this.long
        ? fullSymbol.quoteAsset.name
        : fullSymbol.baseAsset.name
      if (!Strategy.balance.has(key)) {
        this.openDeal(b.close, b.time, b.high, b.low, b.symbol, true)
      }
    }
    if (checkPortfolio) {
      this.checkPortfolio(b.time, b.close, b.symbol)
      this.checkEquityDrawdown()
    }
    for (let d of Strategy.getDeals('open', b.symbol)) {
      let tpOrder: FullGrid | undefined
      tpOrder = this.checkCloseTimer(d, b)
      const bOpenHigh = { ...b, low: b.open }
      const bLowClose = { ...b, high: b.close }
      const bHighClose = { ...b, low: b.close }
      const bOpenLow = { ...b, high: b.open }
      const candleType = this.getCandleType(b)
      let closePrice = 0
      if (this.long && !tpOrder) {
        if (candleType === CandleTypeEnum.bull) {
          // open -> low. Check DCA and SL
          const r = this.processGridOrders(d, b)
          d = r.deal
          closePrice = r.closePrice
          if (d.status !== 'closed') {
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
            const r = this.processGridOrders(d, b)
            d = r.deal
            closePrice = r.closePrice
            if (d.status !== 'closed') {
              d = this.processDCAOrders(d, b)
              const slReturn = this.getSLOrder(d, b)
              d = slReturn.deal
              if (slReturn.order) {
                tpOrder = slReturn.order
              }
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
            const r = this.processGridOrders(d, b)
            d = r.deal
            closePrice = r.closePrice
            if (d.status !== 'closed') {
              d = this.processDCAOrders(d, b)
              const slReturn = this.getSLOrder(d, b)
              d = slReturn.deal
              if (slReturn.order) {
                tpOrder = slReturn.order
              }
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
          const r = this.processGridOrders(d, bOpenHigh)
          d = r.deal
          closePrice = r.closePrice
          if (d.status !== 'closed') {
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
      }
      if (tpOrder) {
        const r = this.closeDeal(d, b, tpOrder)
        d = r.deal
        closePrice = r.closePrice
      }
      if (d.status === 'closed') {
        this.processDealCloseFromMap(d)
        if (closePrice && cbClose) {
          cbClose(closePrice)
        }
      } else {
        this.setDeal(d, d.status, b.symbol)
      }
    }
    this.checkPosition(b)
    const openDeals = Strategy.getDeals('open')
    if ((this.long || this.futures) && !this.coinm) {
      const all = openDeals.reduce(
        (acc, deal) => (acc += deal.usage.current.quote),
        0,
      )
      if (all > Strategy.maxUsage.bot) {
        Strategy.maxUsage.bot = all
        Strategy.maxUsage.botQuote = all
      }
    } else if (!this.long || this.coinm) {
      const all = openDeals.reduce(
        (acc, deal) => (acc += deal.usage.current.base),
        0,
      )
      if (all > Strategy.maxUsage.bot) {
        Strategy.maxUsage.bot = all
        Strategy.maxUsage.botQuote = openDeals.reduce(
          (acc, deal) =>
            acc +
            deal.filledOrders
              .filter(
                (df) =>
                  df.type &&
                  [DCAOrderTypeEnum.dca, DCAOrderTypeEnum.bo].includes(df.type),
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
    if (botFunctions.isTrailingSl /* || botFunctions.isTrailingTp */) {
      return d
    }
    if (
      this.settings.moveSL &&
      typeof this.settings.moveSLTrigger !== 'undefined' &&
      typeof this.settings.moveSLValue !== 'undefined' &&
      (this.settings.dealCloseConditionSL === CloseConditionEnum.tp ||
        !d.moveSlActivated)
    ) {
      const trigger = +this.settings.moveSLTrigger / 100
      const value = +this.settings.moveSLValue / 100
      const last = this.long ? b.low : b.high
      const { avgPrice } = d
      const diff = this.long
        ? last - (avgPrice ?? last)
        : (avgPrice ?? last) - last
      const perc = diff / (avgPrice ?? 0)
      if (
        !isNaN(perc) &&
        isFinite(perc) &&
        perc - this.userFee * 2 >= trigger
      ) {
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
    const qty = Strategy.combo
      ? this.long
        ? this.profitBase
          ? (deal.initialBalance.quote - deal.currentBalance.quote) /
            (_price || deal.avgPrice)
          : deal.currentBalance.base
        : this.profitBase
        ? deal.currentBalance.quote / (_price || deal.avgPrice)
        : deal.initialBalance.base - deal.currentBalance.base
      : filledRegular.reduce((acc, g) => acc + g.qty, 0) -
        filledTP.reduce((acc, g) => acc + g.qty, 0)
    const origQty = qty
    const quote = Strategy.combo
      ? deal.currentBalance.quote
      : filledRegular.reduce((acc, g) => acc + g.qty * g.price, 0) -
        filledTP.reduce((acc, g) => acc + g.qty * g.price, 0)
    const sellDisplacement = this.userFee * 2
    const priceDisplacement = this.long
      ? 1 + sellDisplacement
      : 1 - sellDisplacement
    const price = Strategy.combo
      ? deal.avgPrice * priceDisplacement
      : (sl && this.baseSlOn === BaseSlOnEnum.start
          ? deal.startPrice
          : quote / qty) * priceDisplacement
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
    if (this.tpAr && !sl && !_price) {
      const indicator = this.settings.indicators.find(
        (ind) =>
          ind.indicatorAction === IndicatorAction.closeDeal &&
          ind.section !== IndicatorSection.sl,
      )
      if (indicator) {
        let value = (deal.dynamicAr ?? []).find(
          (d) => d.id === indicator.uuid,
        )?.value
        if (value && !isNaN(value) && isFinite(value)) {
          value *= +(indicator.dynamicArFactor || '1')
          tpOrder.price = this.math.round(
            deal.avgPrice + value * (this.long ? 1 : -1),
            symbol?.priceAssetPrecision ?? 8,
          )
        }
      }
    }
    if (this.slAr && sl && !_price) {
      const indicator = this.settings.indicators.find(
        (ind) =>
          ind.indicatorAction === IndicatorAction.closeDeal &&
          ind.section === IndicatorSection.sl,
      )
      if (indicator) {
        let value = (deal.dynamicAr ?? []).find(
          (d) => d.id === indicator.uuid,
        )?.value
        if (value && !isNaN(value) && isFinite(value)) {
          value *= +(indicator.dynamicArFactor || '1')
          tpOrder.price = this.math.round(
            deal.startPrice + value * (this.long ? -1 : 1),
            symbol?.priceAssetPrecision ?? 8,
          )
        }
      }
    }
    if (qty < 0 && Strategy.combo) {
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
      Strategy.combo
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
          const modQty = this.math.remainder(
            this.math.round(qtyTp, 12),
            symbol.baseAsset.step,
          )
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
    if (
      sl &&
      useMultiSl &&
      this.settings.dealCloseConditionSL === CloseConditionEnum.tp
    ) {
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
          const modQty = this.math.remainder(
            this.math.round(qtySl, 12),
            symbol.baseAsset.step,
          )
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
    const _b = Strategy.combo ? (this.profitBase ? d.profit.total : 0) : 0
    const _q = Strategy.combo ? (!this.profitBase ? d.profit.total : 0) : 0
    const base = this.futures
      ? this.coinm
        ? this.long
          ? d.currentBalance.base
          : d.initialBalance.base - (d.currentBalance.base - _b)
        : 0
      : this.long
      ? 0
      : d.initialBalance.base - (d.currentBalance.base - _b)

    const quote = this.futures
      ? this.coinm
        ? 0
        : !this.long
        ? d.currentBalance.quote
        : d.initialBalance.quote - (d.currentBalance.quote - _q)
      : this.long
      ? d.initialBalance.quote - (d.currentBalance.quote - _q)
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
    const usdRate =
      this.getUsdRate(
        d.symbol.pair,
        d.lastPrice,
        this.profitBase ? 'base' : 'quote',
      ) ?? 1
    const precision = this.precision.get(d.symbol.pair) ?? 8
    const commission = filledOrders
      .filter((o) => (Strategy.combo ? o.type === DCAOrderTypeEnum.tp : true))
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

    const quote = Strategy.combo
      ? this.long
        ? d.initialBalance.quote - d.currentBalance.quote
        : d.currentBalance.quote
      : regularOrders.reduce((acc, ro) => (acc += ro.qty * ro.price), 0)
    const base = Strategy.combo
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
    if (pureProfit !== 0 && Strategy.combo) {
      Strategy.profits.push({
        total: pureProfit,
        totalUsd: pureProfit * usdRate,
        time,
      })
    }
    const total = pureProfit

    const totalUsd = total * usdRate
    const usageBase =
      this.comboBasedOn === ComboTpBase.full
        ? d.usage.max.base
        : d.usage.current.base
    const usageQuote =
      this.comboBasedOn === ComboTpBase.full
        ? d.usage.max.quote
        : d.usage.current.quote
    const denominator = Strategy.combo
      ? this.futures
        ? this.coinm
          ? usageBase
          : usageQuote
        : this.long
        ? usageQuote * (this.profitBase ? 1 / d.lastPrice : 1)
        : usageBase * (this.profitBase ? 1 : d.lastPrice)
      : this.profitBase
      ? base
      : quote
    const perc = this.math.round(
      (total / denominator) * 100 * /* Strategy.combo ? 1 : */ this.leverage,
      2,
      false,
      true,
    )
    /* console.log(
      'profit',
      base,
      'base',
      qty,
      'qty',
      quoteTp,
      'qtp',
      quote,
      'q',
      d.profit.total,
      'deal',
      perc,
      'perc',
      total,
      'total',
      denominator,
      'deno',
      commission,
      'fee',
      { ...d },
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
    const number = Strategy.getDeals('closed').filter(
      (d) => d.closedTime && d.closedTime > d.startTime,
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
    const firstData = firstDataMap.get(Strategy.lowestDataForBnHSymbol)
    const lastData = lastDataMap.get(Strategy.lowestDataForBnHSymbol)
    if (!lastData || !firstData) {
      return
    }
    const usdRateQuote = this.usdRateQuote.get(firstData.symbol) ?? 1
    const usdRate = this.usdRate.get(firstData.symbol) ?? 1
    const firstPrice = firstData?.close
    const lastPrice = lastData?.close
    const buyAndHoldUsage =
      (Strategy.initialBalance ?? 0) * (this.profitBase ? firstPrice : 1)
    const buyAndHold =
      firstPrice && lastPrice
        ? (buyAndHoldUsage / firstPrice) * lastPrice - buyAndHoldUsage
        : 0
    /* const buyAndHoldLastEquity =
      (firstPrice && lastPrice
        ? (buyAndHoldUsage / firstPrice) * lastPrice
        : 0) * this.leverage */
    const lowestData = Array.from(Strategy.lowestDataForBnH.values())
    const buyAndHoldEquity: BuyAndHoldEquity[] = []
    /*     buyAndHoldEquity.push({ value: buyAndHoldUsage, time: firstData.time })
    buyAndHoldEquity.push({ value: buyAndHoldLastEquity, time: lastData.time }) */
    if (lowestData.length > 2) {
      const steps = Math.min(Math.floor(lowestData.length / 2), 500)
      const step = Math.floor(lowestData.length / steps)
      const data: FullBar[] = []
      data.push(firstData)
      for (const i of [...Array(steps).keys()]) {
        const d = lowestData[i * step]
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
          buyAndHoldUsage * (this.profitBase ? usdRateQuote : usdRate),
          4,
        ),
        time: firstData.time,
      })
      for (const d of data) {
        const lp = d.close
        const bh = this.math.round(
          firstPrice && lp
            ? (buyAndHoldUsage / firstPrice) *
                lp *
                (this.profitBase ? usdRateQuote : usdRate)
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

  private calculateCwr(deals: Deal[], lastDataItem: FullBar): number {
    const dealsByStart = deals.sort((a, b) => a.startTime - b.startTime)
    const [first] = dealsByStart
    if (!first) {
      return 0
    }
    const startDate = new Date(first.startTime)
    startDate.setHours(0, 0, 0, 0)
    const x: number[] = []
    const y: number[] = []
    let cwr = 0
    for (
      let i = startDate.getTime(), prev = 0, day = 1;
      prev <= (lastDataItem?.time ?? -1);
      i = startDate.getTime(), day++
    ) {
      const _deals = Strategy.getDeals('closed').filter(
        (d) => d.closedTime && d.closedTime >= prev && d.closedTime < i,
      )

      const profit = _deals.reduce((acc, v) => (acc += v.profit.total), 0)
      const usage = _deals.reduce(
        (acc, v) =>
          (acc += this.futures
            ? this.coinm
              ? Strategy.combo
                ? v.usage.max.base
                : v.usage.current.base
              : Strategy.combo
              ? v.usage.max.quote
              : v.usage.current.quote
            : this.long
            ? (Strategy.combo ? v.usage.max.quote : v.usage.current.quote) *
              (this.profitBase ? 1 / v.startPrice : 1)
            : (Strategy.combo ? v.usage.max.base : v.usage.current.base) *
              (this.profitBase ? 1 : v.startPrice)),
        0,
      )
      x.push(day)
      y.push((y[y.length - 1] ?? 0) + (usage === 0 ? 0 : profit / usage))

      startDate.setHours(24)

      prev = i
    }
    const beta =
      x.reduce((acc, v, i) => acc + v * y[i], 0) /
      x.reduce((acc, v) => acc + v ** 2, 0)

    const yPredict = x.map((v) => v * beta)

    const ssTot = y.reduce((acc, v) => acc + v ** 2, 0)

    const ssRes = y.reduce((acc, v, i) => acc + (v - yPredict[i]) ** 2, 0)

    const rSq = 1 - ssRes / ssTot

    const durationInPeriod = x.length

    const annualizedReturn = y[y.length - 1] * (365 / durationInPeriod)

    cwr = this.math.round(annualizedReturn * rSq, 4)

    return cwr
  }

  private prepareDeals(deals: Deal[]): PreparedDeal[] {
    if (Strategy.fullResult) {
      return deals
    }
    return deals.map((d) => ({
      symbol: d.symbol,
      transactions: d.transactions.map((t) => ({
        _id: t._id,
        updateTime: t.updateTime,
        side: t.side,
        amountBaseBuy: t.amountBaseBuy,
        amountQuoteBuy: t.amountQuoteBuy,
        amountBaseSell: t.amountBaseSell,
        amountQuoteSell: t.amountQuoteSell,
        priceBuy: t.priceBuy,
        priceSell: t.priceSell,
        profit: t.profit,
        profitUsd: t.profitUsd,
        baseAsset: t.baseAsset,
        quoteAsset: t.quoteAsset,
        profitAsset: t.profitAsset,
        index: t.index,
      })),
      mingrids: d.mingrids.map((m) => ({
        id: m.id,
        status: m.status,
        initialPrice: m.initialPrice,
        lastPrice: m.lastPrice,
        profit: m.profit,
        avgPrice: m.avgPrice,
        createTime: m.createTime,
        updateTime: m.updateTime,
        closeTime: m.closeTime,
        transactions: m.transactions,
        settings: {
          profitCurrency: m.settings.profitCurrency,
        },
      })),
      id: d.id,
      filledOrders: d.filledOrders.map((o) => ({
        price: o.price,
        side: o.side,
        id: o.id,
        filledTime: o.filledTime,
        startTime: o.startTime,
        dealId: o.dealId,
      })),
      ordersHistory: d.ordersHistory.map((o) => ({
        price: o.price,
        side: o.side,
        id: o.id,
        filledTime: o.filledTime,
        startTime: o.startTime,
        dealId: o.dealId,
        avgLine: o.avgLine,
      })),
      status: d.status,
      startTime: d.startTime,
      closedTime: d.closedTime,
      profit: d.profit,
      usage: d.usage,
      levels: d.levels,
      duration: d.duration,
      splitDuration: d.splitDuration,
      number: d.number,
      avgPrice: d.avgPrice,
      startPrice: d.startPrice,
      liquidationPrice: d.liquidationPrice,
      closePrice: d.closePrice,
      volume: d.volume,
      equity: d.equity,
      equityInAsset: d.equityInAsset,
    }))
  }

  public returnResult(
    firstData: Map<string, FullBar>,
    lastData: Map<string, FullBar>,
    loadingTime: number,
    processingTime: number,
  ): DCABacktestingResult {
    const startResultProcessing = new Date().getTime()
    let allDeals = Strategy.getDeals()
    allDeals = allDeals.map((d) => {
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
      allDeals.length > 0
        ? allDeals[0].initialOrders
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
      +maxNumberOfOpenDealsString >= 0 &&
      (Strategy.multi || (!Strategy.multi && !useMulti))
    ) {
      maxNumberOfOpenDeals = +maxNumberOfOpenDealsString
    }
    if (
      maxDealsPerPair &&
      maxDealsPerPair !== '' &&
      !isNaN(+maxDealsPerPair) &&
      +maxDealsPerPair >= 0 &&
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
    const totalDuration = allDeals.reduce((acc, d) => (acc += d.duration), 0)
    const lastDataItem = lastData?.values().next().value
    const firstDataItem = firstData?.get(lastDataItem?.symbol ?? '')
    const workingTime = Strategy.workingShift.reduce(
      (acc, ws) =>
        (acc += (ws.end || lastDataItem?.time || ws.start) - ws.start),
      0,
    )
    const closedDeals = allDeals.filter((d) => d.status === 'closed')
    const avgDuration =
      allDeals.length > 0
        ? this.math.round(totalDuration / allDeals.length, 0)
        : 0
    const openedDeals = allDeals.filter((d) => d.status === 'open')
    const workingDays = this.math.round(workingTime / (24 * 60 * 60 * 1000), 4)
    const profitDeals = allDeals.filter(
      (d) => d.profit.perc > 0 && d.status === 'closed',
    )
    const lossDeals = allDeals.filter(
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
      allDeals.length > 0
        ? this.math.round(
            allDeals.reduce(
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
              allDeals.length /
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
          const quote = Strategy.combo
            ? (this.long
                ? od.initialBalance.quote - od.currentBalance.quote
                : od.currentBalance.quote) +
              (this.profitBase ? 0 : od.profit.total * (this.long ? 1 : -1))
            : filledOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0) -
              filledTPOrders.reduce((acc, fo) => (acc += fo.qty * fo.price), 0)
          const base = Strategy.combo
            ? this.long
              ? od.currentBalance.base
              : od.initialBalance.base - od.currentBalance.base
            : filledOrders.reduce((acc, fo) => (acc += fo.qty), 0) -
              filledTPOrders.reduce((acc, fo) => (acc += fo.qty), 0)
          const comboBase =
            quote / tpPrice +
            (this.profitBase ? od.profit.total * (this.long ? 1 : -1) : 0)
          const quoteTp = qty * tpPrice
          const commission = Strategy.combo
            ? this.profitBase
              ? qty * this.userFee
              : qty * tpPrice * this.userFee
            : od.filledOrders.reduce(
                (acc, v) =>
                  (acc += this.profitBase
                    ? v.qty * this.userFee
                    : v.qty * v.price * this.userFee),
                0,
              )
          const unPnl =
            od.profit.total +
            (Strategy.combo
              ? (this.profitBase ? base - comboBase : quoteTp - quote) *
                (this.long ? 1 : -1)
              : (this.profitBase
                  ? base - qty + (qty * tpPrice - quote) / tpPrice
                  : qty * tpPrice - quote + (qty - base) * tpPrice) *
                (this.long ? 1 : -1)) -
            commission

          const usdRateCurrent = this.usdRate.get(od.symbol.pair) ?? 1
          unrealizedPnL += unPnl
          unrealizedPnLUsd += unPnl * usdRateCurrent
          unrealizedUsage +=
            ((Strategy.combo
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
          /* const baseAmount = od.currentBalance.base / this.leverage
          const quoteAmount = od.currentBalance.quote / this.leverage
          const baseRate = this.getUsdRate(od.symbol.pair, tpPrice, 'base')
          const quoteRate = this.getUsdRate(od.symbol.pair, tpPrice, 'quote')
          od.portfolio = {
            base: this.math.round(baseAmount * baseRate, 3),
            quote: this.math.round(quoteAmount * quoteRate, 3),
          }
          od.lastTime = lastDataItem?.time
          Strategy.deals = Strategy.deals.map((d) => {
            if (d.id === od.id) {
              return od
            }
            return d
          }) */
        }
      }
      /*  if (this.futures) {
        for (const od of openedDeals) {
          od.portfolio = {
            base: this.coinm
              ? this.math.round(unrealizedPnLUsd + Strategy.balanceUsd, 3)
              : 0,
            quote: this.coinm
              ? 0
              : this.math.round(unrealizedPnLUsd + Strategy.balanceUsd, 3),
          }
          Strategy.deals = Strategy.deals.map((d) => {
            if (d.id === od.id) {
              return od
            }
            return d
          })
        }
      } */
    }
    const levels = allDeals.map((d) => d.levels.max)
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
      if (allDeals.length > 0) {
        return priceDeviation(allDeals[0].initialOrders)
      }
      return 0
    }
    const actualPriceDeviation = () => {
      if (allDeals.length > 0) {
        return priceDeviation(
          allDeals.sort((a, b) => b.levels.max - a.levels.max)[0].filledOrders,
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
        const deals = allDeals.filter(
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
      if (!Strategy.combo) {
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
    if (allDeals.length < maxDealsPerResult) {
      for (const s of this.symbols.keys()) {
        const deals = allDeals.filter((d) => d.symbol.pair === s)
        const maxSymbolValue =
          this.settings.orderSizeType === OrderSizeTypeEnum.percFree ||
          this.settings.orderSizeType === OrderSizeTypeEnum.percTotal
            ? Strategy.initialBalanceUsd
            : Math.max(
                .../* this.settings.orderSizeType === OrderSizeTypeEnum.percFree ||
          this.settings.orderSizeType === OrderSizeTypeEnum.percTotal
            ? [deals.sort((a, b) => a.startTime - b.startTime)[0]].filter(
                (d) => !!d,
              )
            : */ deals.map(
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
              Math.max(1, +(this.settings.maxDealsPerPair ?? '1'))
        const profitDealsStats = deals.filter(
          (d) => d.profit.total > 0 && d.status === 'closed',
        )
        const lossDealsStats = deals.filter(
          (d) => d.profit.total <= 0 && d.status === 'closed',
        )
        const closedDealsStats = deals.filter(
          (d) => d.status === 'closed',
        ).length
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
        const grossProfit =
          maxSymbolValue === 0
            ? 0
            : (profitDealsStats.reduce((acc, d) => acc + d.profit.totalUsd, 0) /
                maxSymbolValue) *
              100
        const grossLoss =
          maxSymbolValue === 0
            ? 0
            : Math.abs(
                lossDealsStats.reduce((acc, d) => acc + d.profit.totalUsd, 0) /
                  maxSymbolValue,
              ) * 100
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
            ? this.math.round(
                (profitDealsStats.length / closedDealsStats) * 100,
              )
            : 0,
          maxDealDuration,
          avgDealDuration,
          profitFactor:
            grossLoss === 0
              ? `${Infinity}`
              : `${this.math.round(grossProfit / grossLoss, 3)}`,
        })
      }
    }
    const periodicStats: PeriodicStats[] = []
    const firstDataTime = Strategy.start || (firstDataItem?.time ?? +new Date())
    const lastDataTime =
      (lastDataItem?.time as number | undefined) ?? +new Date()

    let monthlyValue = Strategy.initialBalanceUsd

    if (allDeals.length < maxDealsPerResult) {
      for (
        let i = firstDataTime;
        i < lastDataTime;
        i += 28 * 24 * 60 * 60 * 1000
      ) {
        const monthlyStart = new Date(i)
        monthlyStart.setDate(1)
        monthlyStart.setHours(0, 0, 0, 0)
        const nextMonth = new Date(monthlyStart)
        nextMonth.setDate(1)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const findMonth = periodicStats.find(
          (p) => p.startTime === +monthlyStart && p.period === 'month',
        )
        if (findMonth) {
          continue
        }
        const monthlyDeals = allDeals.filter(
          (d) =>
            d.closedTime &&
            d.closedTime >= +monthlyStart &&
            d.closedTime <= +nextMonth - 1,
        )
        let lowestBalanceDD = monthlyValue
        let highestBalanceDD = monthlyValue
        let lowestBalanceRU = monthlyValue
        let highestBalanceRU = monthlyValue
        let maxDrawdown = 0
        let maxRunup = 0
        let maxDrawdownValue = 0
        let maxRunupValue = 0
        let profit = 0
        const startPeriodValue = Math.abs(monthlyValue)
        for (const d of monthlyDeals) {
          profit += d.profit.totalUsd
          monthlyValue += d.profit.totalUsd
          if (monthlyValue > highestBalanceRU) {
            highestBalanceRU = monthlyValue
            const tempRunup = highestBalanceRU - lowestBalanceRU
            if (tempRunup > maxRunupValue) {
              maxRunupValue = tempRunup
              maxRunup = Math.abs(tempRunup / lowestBalanceRU)
            }
          }
          if (monthlyValue < lowestBalanceRU) {
            lowestBalanceRU = monthlyValue
            highestBalanceRU = monthlyValue
          }
          if (monthlyValue < lowestBalanceDD) {
            lowestBalanceDD = monthlyValue
            const tempDrawdown = highestBalanceDD - lowestBalanceDD
            if (tempDrawdown > maxDrawdownValue) {
              maxDrawdownValue = tempDrawdown
              maxDrawdown = Math.abs(tempDrawdown / highestBalanceDD)
            }
          }
          if (monthlyValue > highestBalanceDD) {
            highestBalanceDD = monthlyValue
            lowestBalanceDD = monthlyValue
          }
        }
        const netResult = this.math.round((profit / startPeriodValue) * 100)
        periodicStats.push({
          period: 'month',
          startTime: +monthlyStart,
          netResult,
          drawdown: Math.min(
            netResult,
            this.math.round(Math.abs(maxDrawdown) * -100),
          ),
          runup: Math.max(netResult, this.math.round(Math.abs(maxRunup) * 100)),
          deals: {
            profit: monthlyDeals.filter((d) => d.profit.totalUsd > 0).length,
            loss: monthlyDeals.filter((d) => d.profit.totalUsd <= 0).length,
          },
        })
      }
    }

    let yearlyValue = Strategy.initialBalanceUsd
    if (allDeals.length < maxDealsPerResult) {
      for (
        let i = firstDataTime;
        i < lastDataTime + 365 * 24 * 60 * 60 * 1000;
        i += 365 * 24 * 60 * 60 * 1000
      ) {
        const yearStart = new Date(i)
        yearStart.setDate(1)
        yearStart.setHours(0, 0, 0, 0)
        yearStart.setMonth(0)
        const findYear = periodicStats.find(
          (p) => p.startTime === +yearStart && p.period === 'year',
        )
        if (findYear) {
          continue
        }
        if (
          !allDeals.filter((d) => d.closedTime && d.closedTime >= +yearStart)
            .length
        ) {
          continue
        }
        const nextYear = new Date(yearStart)
        nextYear.setFullYear(nextYear.getFullYear() + 1)
        const yearlyDeals = allDeals.filter(
          (d) =>
            d.closedTime &&
            d.closedTime >= +yearStart &&
            d.closedTime <= +nextYear - 1,
        )
        let highestBalanceRU = yearlyValue
        let lowestBalanceRU = yearlyValue
        let highestBalanceDD = yearlyValue
        let lowestBalanceDD = yearlyValue
        let maxDrawdown = 0
        let maxRunup = 0
        let maxDrawdownValue = 0
        let maxRunupValue = 0
        let profit = 0
        const startPeriodValue = Math.abs(yearlyValue)
        for (const d of yearlyDeals) {
          profit += d.profit.totalUsd
          yearlyValue += d.profit.totalUsd
          if (yearlyValue > highestBalanceRU) {
            highestBalanceRU = yearlyValue
            const tempRunup = highestBalanceRU - lowestBalanceRU
            if (tempRunup > maxRunupValue) {
              maxRunupValue = tempRunup
              maxRunup = Math.abs(tempRunup / lowestBalanceRU)
            }
          }
          if (yearlyValue < lowestBalanceRU) {
            lowestBalanceRU = yearlyValue
            highestBalanceRU = yearlyValue
          }
          if (yearlyValue < lowestBalanceDD) {
            lowestBalanceDD = yearlyValue
            const tempDrawdown = highestBalanceDD - lowestBalanceDD
            if (tempDrawdown > maxDrawdownValue) {
              maxDrawdownValue = tempDrawdown
              maxDrawdown = Math.abs(tempDrawdown / highestBalanceDD)
            }
          }
          if (yearlyValue > highestBalanceDD) {
            highestBalanceDD = yearlyValue
            lowestBalanceDD = yearlyValue
          }
        }
        const netResult = this.math.round((profit / startPeriodValue) * 100)
        periodicStats.push({
          period: 'year',
          startTime: +yearStart,
          netResult,
          drawdown: Math.min(
            netResult,
            this.math.round(Math.abs(maxDrawdown) * -100),
          ),
          runup: Math.max(netResult, this.math.round(Math.abs(maxRunup) * 100)),
          deals: {
            profit: yearlyDeals.filter((d) => d.profit.totalUsd > 0).length,
            loss: yearlyDeals.filter((d) => d.profit.totalUsd <= 0).length,
          },
        })
      }
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
    /* if (lastDataItem) {
      this.replacePortfolioValue(
        lastDataItem.time,
        Strategy.balanceUsd + unrealizedPnLUsd,
      )
    } */
    const result: DCABacktestingResult = {
      messages: [...new Set(Strategy.messages)],
      portfolio: Array.from(Strategy.portfolio, (v) => ({ x: v[0], y: v[1] })),
      buyAndHoldEquity: buyAndHold?.buyAndHoldEquity ?? [],
      indicatorsEvents: [...Strategy.indicatorEvents],
      symbolStats,
      deals: this.prepareDeals(
        [...allDeals]
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
      ),
      maxLeverage: allDeals.filter((d) => !!d.liquidationPrice).length
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
        maxDealLoss: this.math.round(Strategy.maxLoss.asset, precision),
        maxDealLossPerc: this.math.round(Strategy.maxLoss.perc, 2),
        maxDealProfit: this.math.round(Strategy.maxProfit.asset, precision),
        maxDealProfitPerc: this.math.round(Strategy.maxProfit.perc, 2),
        maxDealLossUsd: this.math.round(Strategy.maxLoss.usd, 2),
        maxDealProfitUsd: this.math.round(Strategy.maxProfit.usd, 2),
        maxDrawDown: -this.math.round(Strategy.seriesLoss.value, precision),
        maxDrawDownUsd: -this.math.round(Strategy.seriesLoss.valueUsd, 2),
        maxDrawDownPerc: this.math.round(
          Strategy.seriesLoss.perc * 100,
          2,
          false,
          true,
        ),
        maxDrawDownEquityUsd: -this.math.round(
          Strategy.seriesLossE.valueUsd,
          2,
        ),
        maxDrawDownEquityPerc: this.math.round(
          Strategy.seriesLossE.perc * 100,
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
      noData: !firstData.size && !lastData.size,
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
        firstDataTime,
        lastDataTime,
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
          allDeals.length > 0
            ? friendlyTime(Math.max(...allDeals.map((cd) => cd.duration)))
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
        all: allDeals.length,
        profit: profitDeals.length,
        loss: lossDeals.length,
        open: openedDeals.length,
        closed: closedDeals.length,
        maxConsecutiveLosses: Strategy.maxConsecutiveLosses,
        maxConsecutiveWins: Strategy.maxConsecutiveWins,
        maxDCATriggered: Math.max(...levels),
        avgDCATriggered:
          allDeals.length > 0
            ? Math.ceil(
                levels.reduce((acc, v) => (acc += v), 0) / allDeals.length,
              )
            : 0,
        dealsPerDay:
          workingDays > 0
            ? this.math.round(closedDeals.length / workingDays, 1, false, true)
            : 0,
        coveredPriceDeviation: Math.max(
          coveredPriceDeviation(),
          actualPriceDeviation(),
        ),
        actualPriceDeviation: actualPriceDeviation(),
        liquidationEvents: allDeals.filter((d) => !!d.liquidationPrice).length,
      },
      ratios: {
        cwr: this.calculateCwr(closedDeals, lastDataItem),
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
              100,
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
      periodicStats,
    }
    Strategy.resetData()
    return result
  }
}
