import { v4 } from 'uuid'
import BotFunctions from '../../helper/botFunctions'
import {
  BotOrderSideEnum,
  ExchangeIntervals,
  BotMarginTypeEnum,
  PositionSide,
  StrategyEnum,
  FuturesStrategyEnum,
} from '../../types'
import { friendlyTime } from '../../helper/timeFunctions'
import { MathHelper } from '../../helper/math'
import findUSDRate from '../../helper/price'

import type {
  Settings,
  Symbols,
  GridBacktestingResult,
  Prices,
  Grid,
  BacktestingTransaction,
  Precision,
  Bar as BarTV,
} from '../../types'

export type Bar = BarTV

export type GRIDStrategyInput = {
  settings: Settings
  symbol: Symbols
  userFee: number
  prices: Prices
  interval?: ExchangeIntervals
}

export interface StrategyInterface {
  loadData(data: BarTV[]): void
  test(): void
  startWorkingShift(start: number): void
  processBar(bar: Bar): void
  checkInRange(price: number, time: number): boolean
  returnResult(
    firstData: Bar,
    lastData: Bar,
    loadingTime: number,
    processingTime: number,
  ): GridBacktestingResult
}

type GridWithTime = Grid & { updateTime: number }

/**
 * Enum for tpsl function
 * @enum {none|sl|tp}
 */
enum TpSlReturn {
  none = 'none',
  sl = 'sl',
  tp = 'tp',
}

export class Strategy implements StrategyInterface {
  protected readonly settings: Settings

  private readonly botFunctions: BotFunctions

  protected workingShift: { start: number; end?: number }[] = []

  private rangeStatus = false

  protected transactions: BacktestingTransaction[] = []

  private totalProfit = 0

  private totalProfitUsd = 0

  protected math = new MathHelper()

  private symbol: Symbols

  private readonly userFee: number

  private readonly usdRate: number

  private firstUsdRate = 0

  private lastUsdRate = 0

  private readonly usdRateQuote: number

  private readonly precision: number

  private readonly precisionQuote: number

  public interval?: ExchangeIntervals

  protected data: BarTV[] = []

  private grids: Grid[] = []

  private smartGrids: Grid[] = []

  private initialGrids: { buy: number; sell: number }[] = []

  private usedOrderId: Set<string> = new Set()

  private filledOrders: GridWithTime[] = []

  private initialBalancesByAsset = {
    base: 0,
    quote: 0,
  }

  private initialBalances = 0

  private initialBalancesUsd = 0

  private currentBalancesByAsset = {
    base: 0,
    quote: 0,
  }

  private currentBalances = 0

  private currentBalancesUsd = 0

  private allPrecision: Precision

  private transactionIndex = 0

  private prices: Prices = []

  private botClosed = false

  private botClosedAndSell = false

  private lastPrice = 0

  private emptyPositon = {
    qty: 0,
    entryPrice: 0,
    liquidationPrice: 0,
    side: PositionSide.LONG,
  }

  private position = this.emptyPositon

  private positionStats = {
    count: 0,
  }

  private initialOpen = false

  private historyLines: NonNullable<GridBacktestingResult['ordersHistory']> = []

  constructor(input: GRIDStrategyInput) {
    const { settings, userFee, symbol, prices, interval } = input
    this.settings = settings
    this.botFunctions = new BotFunctions(settings, userFee, symbol, 0, 0)
    this.botFunctions.forceLocal = true
    this.symbol = symbol
    this.userFee = userFee
    this.usdRate = findUSDRate(
      this.profitBase ? symbol.baseAsset.name : symbol.quoteAsset.name,
      prices,
    )
    this.usdRateQuote = this.profitBase
      ? findUSDRate(symbol.quoteAsset.name, prices)
      : this.usdRate
    this.allPrecision = this.botFunctions.utils.getPrecision(symbol)
    this.precision = this.allPrecision[this.profitBase ? 'base' : 'quote']
    this.precisionQuote = this.botFunctions.utils.getPrecision(symbol).quote
    this.interval = interval
    this.processBar = this.processBar.bind(this)
    this.prices = prices
  }

  public loadData(data: BarTV[]): void {
    this.data = data
    this.botFunctions.initPrice = this.data[0]?.close ?? 0
    if (this.profitBase) {
      this.firstUsdRate =
        findUSDRate(this.symbol.quoteAsset.name, this.prices) *
        (this.data[0]?.close ?? 0)
      this.lastUsdRate =
        findUSDRate(this.symbol.quoteAsset.name, this.prices) *
        (this.data[this.data.length - 1]?.close ?? 0)
    }
  }

  public getOtherIntervals(): ExchangeIntervals[] {
    return []
  }

  public test() {
    for (const d of this.data) {
      this.openPosition(d)
      this.checkPosition(d)
      if (this.botClosed) {
        break
      }
      this.processBar(d)
    }
  }

  private openPosition(d: BarTV) {
    if (this.initialOpen) {
      return
    }
    if (!this.futures) {
      return
    }
    if (this.futuresStrategy === FuturesStrategyEnum.neutral) {
      return
    }
    this.initialOpen = true
    this.botFunctions.lastPrice = d.close
    const grids = this.botFunctions.createOrders(true, false)
    const amount = grids
      .filter(
        (g) =>
          g.side ===
          (this.futuresStrategy === FuturesStrategyEnum.long
            ? BotOrderSideEnum.sell
            : BotOrderSideEnum.buy),
      )
      .reduce((acc, g) => acc + g.qty, 0)
    const side =
      this.futuresStrategy === FuturesStrategyEnum.long
        ? PositionSide.LONG
        : PositionSide.SHORT
    this.position = {
      qty: amount,
      entryPrice: d.close,
      liquidationPrice: this.getLiquidationPrice(d.close, side),
      side,
    }
  }

  public startWorkingShift(start: number): void {
    this.workingShift.push({ start })
  }

  private createGrids(price: number) {
    this.botFunctions.lastPrice = price
    const grids = [...this.botFunctions.createOrders(true, false)]
    this.grids = grids
    this.smartGrids = grids
    if (this.settings.useOrderInAdvance) {
      this.smartGrids = this.botFunctions.createOrders(false, false)
    }
    if (this.initialGrids.length === 0) {
      this.initialGrids = this.botFunctions.getPrices()
    }
    const base = this.grids
      .filter((g) => this.futures || g.side === BotOrderSideEnum.sell)
      .reduce((acc, v) => acc + v.qty, 0)
    const quote = this.grids
      .filter((g) => this.futures || g.side === BotOrderSideEnum.buy)
      .reduce((acc, v) => acc + v.price * v.qty, 0)
    if (this.initialBalances === 0) {
      this.initialBalances = this.futures
        ? this.coinm
          ? base
          : quote
        : this.profitBase
        ? quote / price + base
        : base * price + quote
      this.initialBalancesUsd =
        this.initialBalances * (this.firstUsdRate || this.usdRate)
      this.initialBalancesByAsset = {
        base: this.futures ? (this.coinm ? base : 0) : base,
        quote: this.futures ? (this.coinm ? 0 : quote) : quote,
      }
    }
    this.currentBalances = this.futures
      ? this.coinm
        ? this.initialBalancesByAsset.base + this.totalProfit
        : this.initialBalancesByAsset.quote + this.totalProfit
      : (this.profitBase ? quote / price + base : base * price + quote) +
        this.totalProfit
    this.currentBalancesUsd =
      this.currentBalances * (this.lastUsdRate || this.usdRate)
    this.currentBalancesByAsset = {
      base: this.futures
        ? this.coinm
          ? base + this.totalProfit
          : 0
        : base + (this.profitBase ? this.totalProfit : 0),
      quote: this.futures
        ? this.coinm
          ? 0
          : quote + this.totalProfit
        : quote + (this.profitBase ? 0 : this.totalProfit),
    }
  }

  get isShort() {
    return this.settings.strategy === StrategyEnum.short
  }

  private createTransaction(order: GridWithTime) {
    this.filledOrders.push(order)
    const prices = this.initialGrids
    prices[prices.length - 1].buy = this.math.round(
      +this.settings.topPrice,
      this.symbol.priceAssetPrecision,
    )
    const botFunctionsPrice = this.botFunctions.lastPrice
    this.botFunctions.lastPrice = +this.settings.topPrice * 2
    const grids = [...this.botFunctions.createOrders(true, true)]
    this.botFunctions.lastPrice = botFunctionsPrice
    const { qty, price, side, id, updateTime } = order
    let comBase = side === BotOrderSideEnum.buy ? qty * (this.userFee ?? 0) : 0
    let comQuote =
      side === BotOrderSideEnum.sell ? qty * price * (this.userFee ?? 0) : 0
    let profitQuote = 0
    let matchedPrice = 0
    let matchQty = 0
    let profitBase = 0
    let matchedId = ''
    let profitUsd = 0
    let amountBaseBuy = side === BotOrderSideEnum.sell ? 0 : qty
    let amountQuoteBuy = side === BotOrderSideEnum.sell ? 0 : qty * price
    let amountBaseSell = side === BotOrderSideEnum.buy ? 0 : qty
    let amountQuoteSell = side === BotOrderSideEnum.buy ? 0 : qty * price
    const initialPriceStart = this.data[0]?.close ?? 0
    if (this.settings.newProfit && !this.futures) {
      if (side === BotOrderSideEnum.sell && this.profitBase) {
        comBase = comQuote / price
      }
      if (side === BotOrderSideEnum.buy && !this.profitBase) {
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
      const match = this.filledOrders.find(
        (g) =>
          g.price ===
            (side === BotOrderSideEnum.sell
              ? prices[index - 1]?.buy || 0
              : prices[index + 1]?.sell || 0) &&
          g.side !== side &&
          g.updateTime < updateTime &&
          !this.usedOrderId.has(g.id),
      )
      const needMatch = !this.isShort
        ? side === BotOrderSideEnum.buy ||
          (initialPriceStart &&
            side === BotOrderSideEnum.sell &&
            price <= initialPriceStart)
        : side === BotOrderSideEnum.sell ||
          (initialPriceStart &&
            side === BotOrderSideEnum.buy &&
            price >= initialPriceStart)
      if (!needMatch && !match) {
        this.usedOrderId.add(id)
        matchedId = 'initial price'
        matchQty = this.profitBase
          ? (price * qty) / (initialPriceStart ?? price)
          : qty
        matchedPrice = initialPriceStart ?? price
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
      if (!this.profitBase && !this.futures) {
        if (side === BotOrderSideEnum.buy) {
          comQuote = comBase * price
        }
        if (side === BotOrderSideEnum.sell) {
          let index = prices.findIndex((p) => p.sell === price)
          if (index === -1) {
            index = prices.findIndex((p) => p.buy === price)
          }
          const buyMatch = grids.find(
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
      if (this.profitBase || this.futures) {
        if (side === BotOrderSideEnum.sell) {
          comBase = comQuote / price
        }
        if (side === BotOrderSideEnum.buy && this.futures) {
          comQuote = comBase * price
        }
        if (!this.usedOrderId.has(id)) {
          if (this.futuresStrategy !== FuturesStrategyEnum.neutral) {
            const withMatch =
              (this.futuresStrategy === FuturesStrategyEnum.long &&
                side === BotOrderSideEnum.sell) ||
              (this.futuresStrategy === FuturesStrategyEnum.short &&
                side === BotOrderSideEnum.buy)
            this.usedOrderId.add(id)
            if (withMatch) {
              matchedId = 'position price'
              matchQty = this.profitBase
                ? (price * qty) / (this.position.entryPrice || price)
                : qty
              matchedPrice = this.position.entryPrice || price
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
          } else {
            let index = prices.findIndex(
              (p) =>
                (side === BotOrderSideEnum.sell ? p.sell : p.buy) === price,
            )
            if (index === -1) {
              index = prices.findIndex(
                (p) =>
                  (side === BotOrderSideEnum.sell ? p.buy : p.sell) === price,
              )
            }
            const match = this.filledOrders.find(
              (g) =>
                g.price ===
                  (side === BotOrderSideEnum.sell
                    ? prices[index - 1]?.buy || 0
                    : prices[index + 1]?.sell || 0) &&
                g.side !== side &&
                g.updateTime < updateTime &&
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
    const profit =
      (this.profitBase ? profitBase : profitQuote) -
      (this.profitBase ? comBase : comQuote)
    profitUsd = profit * this.usdRate
    const transaction: BacktestingTransaction = {
      _id: v4(),
      updateTime,
      side,
      amountBaseBuy: this.math.convertFromExponential(
        this.math.round(amountBaseBuy, this.allPrecision.base),
        this.allPrecision.base,
      ),
      amountQuoteBuy: this.math.convertFromExponential(
        this.math.round(amountQuoteBuy, this.allPrecision.quote),
        this.allPrecision.quote,
      ),
      amountBaseSell: this.math.convertFromExponential(
        this.math.round(amountBaseSell, this.allPrecision.base),
        this.allPrecision.base,
      ),
      amountQuoteSell: this.math.convertFromExponential(
        this.math.round(amountQuoteSell, this.allPrecision.quote),
        this.allPrecision.quote,
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
        this.math.round(profit, this.precision + 3),
        this.precision + 3,
      ),
      profitUsd: this.math.round(profitUsd, 2),
      baseAsset: this.symbol.baseAsset.name,
      quoteAsset: this.symbol.quoteAsset.name,
      profitAsset: this.futures
        ? this.coinm
          ? this.symbol.baseAsset.name
          : this.symbol.quoteAsset.name
        : this.profitBase
        ? this.symbol.baseAsset.name
        : this.symbol.quoteAsset.name,
      index: this.transactionIndex,
    }
    this.transactionIndex++
    this.totalProfit += profit
    this.totalProfitUsd += profitUsd
    this.transactions.push(transaction)
  }

  private checkPosition(b: Bar) {
    if (!this.futures) {
      return
    }
    const current = this.position
    const long = current.side === PositionSide.LONG
    const price = long ? b.low : b.high
    const close = long
      ? current.liquidationPrice > price
      : current.liquidationPrice < price
    if (close) {
      const profit = this.coinm
        ? -current.qty / this.leverage
        : -(current.entryPrice * current.qty) / this.leverage
      this.totalProfit += profit
      this.totalProfitUsd +=
        profit * (this.coinm ? price : 1) * this.usdRateQuote
      this.currentBalances = this.initialBalances + this.totalProfit
      this.currentBalancesUsd =
        this.currentBalances * (this.coinm ? price : 1) * this.usdRateQuote
      this.botClosed = true
      this.positionStats.count += 1
      this.position = this.emptyPositon
    }
  }

  private addAvgHistoryLine(time: number) {
    const localAvg = this.historyLines.find(
      (hl) => hl.avgLine && !hl.filledTime,
    )
    const price = this.breakevenPrice()
    if (localAvg?.price === price) {
      return
    }
    if (localAvg) {
      localAvg.filledTime = time
      this.historyLines = [
        ...this.historyLines.filter((hl) => hl.id !== localAvg.id),
        localAvg,
      ]
    }
    this.historyLines.push({
      startTime: time,
      avgLine: true,
      price,
      side: BotOrderSideEnum.buy,
      qty: 0,
      id: this.botFunctions.utils.id(20),
    })
  }

  public processBar(bar: Bar) {
    if (this.grids.length !== 0) {
      for (const p of [bar.close, bar.low, bar.high]) {
        const tpSl = this.tpSl(p)
        if (tpSl !== TpSlReturn.none) {
          return this.closeBot(p, bar.time, tpSl)
        }
      }
    }
    this.checkInRange(bar.close, bar.time)
    if (this.workingShift.length === 0) {
      this.startWorkingShift(bar.time)
      this.createGrids(bar.close)
    }
    const filledBuy = this.grids
      .filter((g) => g.side === BotOrderSideEnum.buy && g.price >= bar.low)
      .sort((a, b) => a.price - b.price)
    filledBuy.forEach((o) => {
      this.createTransaction({ ...o, updateTime: bar.time })
      this.updatePositionWithOrder(o)
    })
    const [lastFilledBuy] = filledBuy
    if (lastFilledBuy) {
      const lastPrice = lastFilledBuy.price
      this.createGrids(lastPrice)
      this.addAvgHistoryLine(bar.time)
    }
    const filledSell = this.grids
      .filter((g) => g.side === BotOrderSideEnum.sell && g.price <= bar.high)
      .sort((a, b) => b.price - a.price)
    filledSell.forEach((o) => {
      this.createTransaction({ ...o, updateTime: bar.time })
      this.updatePositionWithOrder(o)
    })
    const [lastFilledSell] = filledSell
    if (lastFilledSell) {
      const lastPrice = lastFilledSell.price
      this.createGrids(lastPrice)
      this.addAvgHistoryLine(bar.time)
    }
  }

  private closeWorkingShift(time: number) {
    const last = this.workingShift[this.workingShift.length - 1]
    if (!last.end) {
      last.end = time
      this.workingShift = [
        ...this.workingShift.filter((ws) => ws.start !== last.start),
        last,
      ]
    }
  }

  public checkInRange(price: number, time: number) {
    const { topPrice, lowPrice } = this.settings
    let result = true
    result = price >= +lowPrice && price <= +topPrice
    if (!result && this.workingShift.length > 0 && !this.rangeStatus) {
      this.closeWorkingShift(time)
      this.rangeStatus = true
    }
    if (result && this.rangeStatus) {
      this.rangeStatus = false
      this.workingShift.push({ start: time })
    }
    return result
  }

  private getLiquidationPrice(entryPrice: number, position: PositionSide) {
    return (
      entryPrice *
      (this.leverage > 1
        ? (1 +
            (1 / this.leverage) * (position === PositionSide.LONG ? -1 : 1)) *
          (1 + this.userFee * (position === PositionSide.LONG ? -1 : 1))
        : position === PositionSide.LONG
        ? this.userFee
        : 1 / this.userFee)
    )
  }

  private updatePositionWithOrder(order: Grid) {
    if (this.futures) {
      const margin = order.qty
      const sameDirection =
        (this.position.side === PositionSide.LONG &&
          order.side === BotOrderSideEnum.buy) ||
        (this.position.side === PositionSide.SHORT &&
          order.side === BotOrderSideEnum.sell)

      if (sameDirection || this.position.qty === 0) {
        const entryPrice =
          (this.position.qty * this.position.entryPrice +
            order.qty * order.price) /
          (this.position.qty + order.qty)
        const side =
          order.side === BotOrderSideEnum.buy
            ? PositionSide.LONG
            : PositionSide.SHORT
        this.position = {
          side,
          qty: this.position.qty + margin,
          entryPrice,
          liquidationPrice: this.getLiquidationPrice(entryPrice, side),
        }
      } else {
        const diff = this.position.qty - order.qty
        if (Math.abs(diff) <= Number.EPSILON) {
          this.positionStats.count += 1
          this.position = this.emptyPositon
        } else if (diff < 0) {
          this.positionStats.count += 1
          const side =
            this.position.side === PositionSide.SHORT
              ? PositionSide.LONG
              : PositionSide.SHORT
          this.position = {
            qty: -diff,
            entryPrice: order.price,
            side,
            liquidationPrice: this.getLiquidationPrice(order.price, side),
          }
        } else {
          this.position.qty -= margin
        }
      }
    }
  }

  get profitBase() {
    return this.coinm || this.settings.profitCurrency === 'base'
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

  get futuresStrategy() {
    return this.settings.futuresStrategy ?? FuturesStrategyEnum.neutral
  }

  private breakevenPrice() {
    if (this.botClosedAndSell) {
      return 0
    }
    const firstPrice = this.data[0]?.close || 0
    const botFunctionsPrice = this.botFunctions.lastPrice
    this.botFunctions.lastPrice = firstPrice
    const currentGrids = [...this.botFunctions.createOrders(true, false)]
    this.botFunctions.lastPrice = botFunctionsPrice
    let currentBase = this.initialBalancesByAsset.base
    let currentQuote = this.initialBalancesByAsset.quote
    if (this.profitBase) {
      currentBase += this.totalProfit
    }
    if (!this.profitBase) {
      currentQuote += this.totalProfit
    }
    const currentValue = currentBase * firstPrice + currentQuote
    const initialValue =
      firstPrice * this.initialBalancesByAsset.base +
      this.initialBalancesByAsset.quote
    let quote = currentQuote
    let base = currentBase
    let avgPrice = firstPrice
    for (const g of currentGrids.filter((cg) =>
      currentValue > initialValue
        ? cg.side === BotOrderSideEnum.buy
        : currentValue < initialValue
        ? cg.side === BotOrderSideEnum.sell
        : false,
    )) {
      const bPrice = this.botFunctions.lastPrice
      this.botFunctions.lastPrice = g.price

      const currentGridsOnPrice = [
        ...this.botFunctions.createOrders(true, false),
      ]
      this.botFunctions.lastPrice = bPrice
      const newBase =
        currentGridsOnPrice
          .filter((gr) => gr.side === BotOrderSideEnum.sell)
          .reduce((acc, v) => acc + v.qty, 0) +
        (this.profitBase ? this.totalProfit : 0)
      const newQuote =
        currentGridsOnPrice
          .filter((gr) => gr.side === BotOrderSideEnum.buy)
          .reduce((acc, v) => acc + v.qty * v.price, 0) +
        (!this.profitBase ? this.totalProfit : 0)
      if (
        (currentValue > initialValue &&
          newBase * g.price + newQuote > initialValue) ||
        (currentValue < initialValue &&
          newBase * g.price + newQuote < initialValue)
      ) {
        quote = newQuote
        base = newBase
      } else {
        break
      }
    }
    avgPrice = (initialValue - quote) / base
    if (avgPrice === Infinity || avgPrice === -Infinity) {
      avgPrice = 0
    }
    if (isNaN(avgPrice) || this.totalProfit === 0) {
      avgPrice = firstPrice
    }
    if (avgPrice < 0) {
      avgPrice = 0
    }
    return avgPrice
  }

  private tpSl(lastPrice: number): TpSlReturn {
    if (this.settings.tpSl || this.settings.sl) {
      const {
        slLowPrice,
        tpTopPrice,
        tpPerc,
        slPerc,
        tpSlCondition,
        slCondition,
        tpSl,
        sl,
      } = this.settings
      const { initialBalancesByAsset, currentBalancesByAsset } = this
      const initialPriceStart = this.data[0]?.close ?? 0
      if (tpSlCondition === 'priceReached' && tpTopPrice && tpSl) {
        if (lastPrice >= +tpTopPrice) {
          return TpSlReturn.tp
        }
      } else if (slCondition === 'priceReached' && slLowPrice && sl) {
        if (lastPrice <= +slLowPrice) {
          return TpSlReturn.sl
        }
      } else if (
        (tpSlCondition === 'valueChanged' &&
          tpPerc &&
          initialPriceStart &&
          tpSl) ||
        (slCondition === 'valueChanged' && slPerc && initialPriceStart && sl)
      ) {
        const initialValue =
          initialBalancesByAsset.base * initialPriceStart +
          initialBalancesByAsset.quote
        if (this.futures) {
          const current = this.position
          const diff =
            current.side === PositionSide.LONG
              ? lastPrice - current.entryPrice
              : current.entryPrice - lastPrice
          const perc = current.entryPrice !== 0 ? diff / current.entryPrice : 0
          const val = current.qty * perc * lastPrice
          const valueChange = val + this.totalProfit
          const totalPerc = (valueChange / (initialValue / this.leverage)) * 100
          if (
            tpSlCondition === 'valueChanged' &&
            tpPerc &&
            initialPriceStart &&
            tpSl
          ) {
            if (totalPerc >= +tpPerc) {
              return TpSlReturn.tp
            }
          }
          if (
            slCondition === 'valueChanged' &&
            slPerc &&
            initialPriceStart &&
            sl
          ) {
            if (totalPerc <= +slPerc) {
              return TpSlReturn.sl
            }
          }
        } else {
          const currentValue =
            currentBalancesByAsset.base * lastPrice +
            currentBalancesByAsset.quote
          const diff = ((currentValue - initialValue) / initialValue) * 100
          if (
            tpSlCondition === 'valueChanged' &&
            tpPerc &&
            initialPriceStart &&
            tpSl
          ) {
            if (diff >= +tpPerc) {
              return TpSlReturn.tp
            }
          }
          if (
            slCondition === 'valueChanged' &&
            slPerc &&
            initialPriceStart &&
            sl
          ) {
            if (diff <= +slPerc) {
              return TpSlReturn.sl
            }
          }
        }
      }
    }
    return TpSlReturn.none
  }

  private closeBot(price: number, time: number, action: TpSlReturn) {
    this.botClosed = true
    this.grids = []
    this.smartGrids = []
    this.closeWorkingShift(time)
    this.lastPrice = price
    if (
      (this.settings.slAction === 'stopAndSell' && action === TpSlReturn.sl) ||
      (this.settings.tpSlAction === 'stopAndSell' && action === TpSlReturn.tp)
    ) {
      if (this.futures) {
        const current = this.position
        const diff =
          ((price - current.entryPrice) *
            (current.side === PositionSide.LONG ? 1 : -1)) /
          current.entryPrice
        const profit = this.coinm
          ? current.qty * diff
          : current.qty * current.entryPrice * diff
        this.totalProfit += profit
        this.totalProfitUsd +=
          profit * (this.coinm ? price : 1) * this.usdRateQuote
        this.currentBalances = this.initialBalances + this.totalProfit
        this.currentBalancesUsd =
          this.currentBalances * (this.coinm ? price : 1) * this.usdRateQuote
        this.botClosed = true
        this.positionStats.count += 1
        this.position = this.emptyPositon
        return
      }
      this.botClosedAndSell = true
      this.currentBalancesByAsset = {
        base: this.futures
          ? this.coinm
            ? this.currentBalancesByAsset.base
            : 0
          : this.profitBase
          ? this.currentBalancesByAsset.base +
            this.currentBalancesByAsset.quote / price
          : 0,
        quote: this.futures
          ? this.coinm
            ? 0
            : this.currentBalancesByAsset.quote
          : this.profitBase
          ? 0
          : this.currentBalancesByAsset.base * price +
            this.currentBalancesByAsset.quote,
      }
    }
    this.currentBalances = this.futures
      ? this.coinm
        ? this.currentBalancesByAsset.base
        : this.currentBalancesByAsset.quote
      : this.profitBase
      ? this.currentBalancesByAsset.base +
        this.currentBalancesByAsset.quote / price
      : this.currentBalancesByAsset.base * price +
        this.currentBalancesByAsset.quote
    this.currentBalancesUsd = this.currentBalances * this.usdRate
  }

  public returnResult(
    firstData: Bar,
    lastData: Bar,
    loadingTime: number,
    processingTime: number,
  ): GridBacktestingResult {
    const startResultProcessing = new Date().getTime()
    const totalProfit = this.math.round(this.totalProfit, this.precision)
    const totalProfitUsd = this.math.round(this.totalProfitUsd, 2)
    const workingTime = this.workingShift.reduce(
      (acc, ws) => (acc += (ws.end || lastData?.time || ws.start) - ws.start),
      0,
    )
    const workingDays = this.math.round(workingTime / (24 * 60 * 60 * 1000), 4)
    const profitByPeriod: number[] = []
    let periodRatio = 1
    if (workingDays > 3 && this.transactions.length > 0) {
      const transactionsSort = this.transactions.sort(
        (a, b) => a.updateTime - b.updateTime,
      )
      const [first] = transactionsSort
      const startDate = new Date(first.updateTime)
      startDate.setHours(0, 0, 0, 0)
      periodRatio = 365
      if (workingDays - 90 > 0) {
        startDate.setDate(1)
        periodRatio = 12
      }
      for (
        let i = startDate.getTime(), prev = 0;
        prev <= (lastData?.time || -1);
        i = startDate.getTime()
      ) {
        const transactionByPeriod = this.transactions.filter(
          (d) => d.updateTime && d.updateTime >= prev && d.updateTime < i,
        )

        const profit = transactionByPeriod.reduce(
          (acc, v) => (acc += v.profitUsd),
          0,
        )
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
    const buyAndHoldUsage = +this.settings.budget
    const buyAndHold =
      firstPrice && lastPrice
        ? (buyAndHoldUsage / firstPrice) * lastPrice - buyAndHoldUsage
        : 0
    const positionPnL = {
      perc: 0,
      value: 0,
    }
    if (this.futures) {
      const diff = lastPrice - this.position.entryPrice
      const perc =
        (diff / this.position.entryPrice) *
        (this.position.side === PositionSide.LONG ? 1 : -1)

      positionPnL.perc = this.position.qty !== 0 ? perc : 0
      positionPnL.value = this.math.round(
        this.position.qty *
          positionPnL.perc *
          (this.coinm ? 1 : this.position.entryPrice),
        8,
      )
      positionPnL.perc = this.math.round(positionPnL.perc * 100, 2)
    }
    return {
      transaction: this.transactions.sort((a, b) => b.index - a.index),
      noData: !firstData && !lastData,
      ordersHistory: this.historyLines,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      orders: [
        ...this.smartGrids,
        ...this.grids
          .filter(
            (g) =>
              !this.smartGrids.find(
                (sg) =>
                  sg.price === g.price &&
                  sg.qty === g.qty &&
                  sg.side === g.side,
              ),
          )
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          .map((g) => ({ ...g, side: 'GREY' })),
      ],
      financial: {
        profitTotal: this.math.convertFromExponential(
          totalProfit,
          this.precision,
        ),
        profitTotalUsd: totalProfitUsd,
        profitTotalPerc: this.math.round(
          (totalProfit / this.initialBalances) * 100,
          2,
        ),
        budgetUsd:
          (this.usdRateQuote *
            +this.settings.budget *
            (this.coinm ? firstPrice : 1)) /
          this.leverage,
        avgNetDaily:
          workingDays > 0
            ? this.math.convertFromExponential(
                this.math.round(totalProfit / workingDays, this.precision),
                this.precision,
              )
            : '0',
        avgNetDailyUsd:
          workingDays > 0
            ? this.math.round(totalProfitUsd / workingDays, 2)
            : 0,
        avgNetDailyPerc:
          workingDays > 0
            ? this.math.round(
                (totalProfit / workingDays / this.initialBalances) * 100,
                2,
              )
            : 0,
        avgTransactionProfit:
          this.transactions.length > 0
            ? this.math.convertFromExponential(
                this.math.round(
                  this.totalProfit / this.transactions.length,
                  this.precision + 3,
                ),
                this.precision + 3,
              )
            : '0',
        avgTransactionProfitUsd:
          this.transactions.length > 0
            ? this.math.round(this.totalProfitUsd / this.transactions.length, 2)
            : 0,
        avgTransactionProfitPerc:
          this.transactions.length > 0
            ? this.math.round(
                (this.totalProfit /
                  this.transactions.length /
                  this.initialBalances) *
                  100,
                2,
              )
            : 0,
        initialBalances: this.math.convertFromExponential(
          this.math.round(this.initialBalances, this.precision),
          this.precision,
        ),
        initialBalancesUsd: this.math.round(this.initialBalancesUsd, 2),
        currentBalances: this.math.convertFromExponential(
          this.math.round(this.currentBalances, this.precision),
          this.precision,
        ),
        currentBalancesUsd: this.math.round(this.currentBalancesUsd, 2),
        valueChange: this.math.convertFromExponential(
          this.math.round(
            this.currentBalances - this.initialBalances + positionPnL.value,
            this.precision,
          ),
          this.precision,
        ),
        valueChangeUsd: this.math.round(
          this.currentBalancesUsd -
            this.initialBalancesUsd +
            positionPnL.value *
              (this.coinm ? lastPrice : 1) *
              this.usdRateQuote,
          2,
        ),
        valueChangePerc: this.math.round(
          ((this.currentBalances - this.initialBalances + positionPnL.value) /
            this.initialBalances) *
            100,
          2,
        ),
        startPrice: this.math.convertFromExponential(
          this.math.round(firstPrice ?? 0, this.allPrecision.price),
          this.allPrecision.price,
        ),
        lastPrice: this.math.convertFromExponential(
          this.math.round(
            this.lastPrice || lastPrice || 0,
            this.allPrecision.price,
          ),
          this.allPrecision.price,
        ),
        breakevenPrice: this.math.round(
          this.breakevenPrice(),
          this.symbol.priceAssetPrecision,
        ),
        currentBalancesByAsset: {
          base: this.math.convertFromExponential(
            this.math.round(
              this.currentBalancesByAsset.base,
              this.allPrecision.base,
            ),
            this.allPrecision.base,
          ),
          quote: this.math.convertFromExponential(
            this.math.round(
              this.currentBalancesByAsset.quote,
              this.allPrecision.quote,
            ),
            this.allPrecision.quote,
          ),
        },
        initialBalancesByAsset: {
          base: this.math.convertFromExponential(
            this.math.round(
              this.initialBalancesByAsset.base,
              this.allPrecision.base,
            ),
            this.allPrecision.base,
          ),
          quote: this.math.convertFromExponential(
            this.math.round(
              this.initialBalancesByAsset.quote,
              this.allPrecision.quote,
            ),
            this.allPrecision.quote,
          ),
        },
      },
      duration: {
        firstDataTime: firstData?.time || +new Date(),
        lastDataTime: lastData?.time || +new Date(),
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
      },
      numerical: {
        all: this.transactions.length,
        transactionsPerDay:
          workingDays > 0
            ? this.math.round(this.transactions.length / workingDays, 1)
            : 0,
        buy: this.transactions.filter((t) => t.side === BotOrderSideEnum.buy)
          .length,
        sell: this.transactions.filter((t) => t.side === BotOrderSideEnum.sell)
          .length,
      },
      ratios: {
        profitByPeriod,
        buyAndHold: {
          value: this.math.round(buyAndHold, this.precisionQuote),
          valueUsd: this.math.round(buyAndHold * this.usdRateQuote, 2),
          perc: this.math.round(
            (buyAndHold / buyAndHoldUsage) * 100 * this.leverage,
            1,
          ),
        },
        periodRatio,
      },
      interval: this.interval ?? ExchangeIntervals.fiveM,
      quoteRate: lastPrice ?? 0,
      position: {
        count: this.positionStats.count,
        qty: this.position.qty,
        price: this.position.entryPrice,
        side: this.position.side,
        pnl: positionPnL,
      },
    }
  }
}
