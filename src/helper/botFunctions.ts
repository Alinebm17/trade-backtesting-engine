import { BotMarginTypeEnum, StrategyEnum } from '../types'
import BotUtils from './botUtils'

import type { Settings, Symbols, Grid, OrderData } from '../types'

class BotFunctions {
  private math: BotUtils['math']

  private settings: Settings

  private userFee: number

  private symbol: Symbols

  private latestPrice: number

  private initialPrice: number

  public forceLocal = false

  utils: BotUtils

  constructor(
    settings: Settings,
    userFee: number,
    symbol: Symbols,
    latestPrice: number,
    initialPrice: number,
  ) {
    this.settings = settings
    this.userFee = userFee
    this.symbol = symbol
    this.latestPrice = latestPrice
    this.initialPrice = initialPrice
    this.utils = new BotUtils()
    this.math = this.utils.math
  }

  set sett(settings: Partial<Settings>) {
    this.settings = {
      ...this.settings,
      ...settings,
    }
  }

  set fee(userFee: number) {
    this.userFee = userFee
  }

  set sym(symbol: Symbols) {
    this.symbol = symbol
  }

  set all(data: { settings: Settings; userFee: number; symbol: Symbols }) {
    this.settings = data.settings
    this.userFee = data.userFee
    this.symbol = data.symbol
  }

  set lastPrice(latestPrice: number) {
    this.latestPrice = latestPrice
  }

  get lastPrice() {
    return this.latestPrice
  }

  set initPrice(initialPrice: number) {
    this.initialPrice = initialPrice
  }

  get initPrice() {
    return this.initialPrice
  }

  findClosestGrids(grids: Grid[], latestPrice: number, n?: number) {
    if (
      (this.settings.ordersInAdvance && this.settings.useOrderInAdvance) ||
      n
    ) {
      let arrayResult: Grid[] = []
      let copyArray = [...grids].sort((a, b) => a.price - b.price)
      const ordersInAdvance =
        n ||
        (this.settings.ordersInAdvance
          ? parseInt(`${this.settings.ordersInAdvance}`)
          : 0)
      const maxNumber =
        ordersInAdvance > copyArray.length ? copyArray.length : ordersInAdvance

      do {
        const result = copyArray.sort((a, b) => {
          return (
            Math.abs(latestPrice - a.price) - Math.abs(latestPrice - b.price)
          )
        })
        copyArray = copyArray.filter((v) => v !== result[0])
        arrayResult.push(result[0])
      } while (arrayResult.length < maxNumber)
      let sellCount = 0
      let buyCount = 0
      arrayResult = arrayResult.sort((a, b) => a.price - b.price)
      arrayResult.map((r) => {
        if (r.side === 'SELL') {
          sellCount++
        } else {
          buyCount++
        }
      })
      const prices = this.getPrices()
      let num =
        (ordersInAdvance % 2 === 0 ? ordersInAdvance : ordersInAdvance - 1) / 2
      copyArray = [...copyArray.sort((a, b) => a.price - b.price)]
      if ((buyCount < num || sellCount < num) && prices.length > num) {
        const sellLeft = prices.filter((p) => p.buy > latestPrice).length
        const buyLeft = prices.filter((p) => p.buy < latestPrice).length
        num = Math.min(sellLeft, num)
        if (
          prices[prices.length - num] &&
          prices[prices.length - num].buy > latestPrice &&
          sellCount < num
        ) {
          const neededSell = num - sellCount
          const sellArray = copyArray.filter((o) => o.side === 'SELL')
          arrayResult.splice(0, neededSell)
          arrayResult = [...arrayResult, ...sellArray.splice(0, neededSell)]
        }
        num = Math.min(buyLeft, num)
        if (prices[num] && prices[num].buy < latestPrice && buyCount < num) {
          const neededBuy = num - buyCount
          const buyArray = copyArray.filter((o) => o.side === 'BUY')
          arrayResult.splice(arrayResult.length - neededBuy, neededBuy)
          arrayResult = [
            ...arrayResult,
            ...buyArray.splice(buyArray.length - neededBuy, neededBuy),
          ]
        }
      }
      return arrayResult.sort((a, b) => a.price - b.price)
    }
    return grids
  }

  getPrices() {
    const {
      settings: { lowPrice, topPrice, levels, sellDisplacement, gridType },
      symbol,
    } = this
    const low = parseFloat(`${lowPrice}`)
    const top = parseFloat(`${topPrice}`)
    const newGS = (top / low) ** (1 / parseFloat(`${levels}`)) - 1
    const prices: { buy: number; sell: number }[] = []
    let sellD = parseFloat(`${sellDisplacement}`)
    sellD = isNaN(sellD) ? 0 : sellD / 100
    if (gridType === 'arithmetic') {
      const step = (top - low) / parseFloat(`${levels}`)
      for (let i = 0; i <= parseFloat(`${levels}`); i++) {
        const p = this.math.round(low + step * i, symbol.priceAssetPrecision)
        prices.push({
          buy: this.math.round(p, symbol.priceAssetPrecision),
          sell: this.math.round(p * (1 + sellD), symbol.priceAssetPrecision),
        })
      }
    } else if (gridType === 'geometric') {
      for (
        let i = this.math.round(low, symbol.priceAssetPrecision);
        i <= top * (1 + newGS / 2);
        i *= 1 + newGS
      ) {
        prices.push({
          buy: this.math.round(i, symbol.priceAssetPrecision),
          sell: this.math.round(i * (1 + sellD), symbol.priceAssetPrecision),
        })
      }
    }
    return prices
  }

  createOrders(all = false, nosplice = false): Grid[] {
    const { settings, symbol, forceLocal, latestPrice, userFee, initialPrice } =
      this
    const {
      lowPrice,
      topPrice,
      budget,
      levels,
      useStartPrice,
      startPrice,
      updatedBudget,
      sellDisplacement,
      gridType,
      futures,
      profitCurrency,
      orderFixedIn,
      coinm,
      futuresStrategy,
      ordersInAdvance,
      useOrderInAdvance,
    } = settings
    return this.utils.createGridOrders(
      {
        lowPrice,
        topPrice,
        budget,
        levels,
        useStartPrice,
        startPrice,
        updatedBudget,
        forceLocal,
        symbol,
        _latestPrice: latestPrice,
        userFee,
        sellDisplacement,
        gridType,
        initialPrice,
        futures: !!futures,
        profitCurrency,
        orderFixedIn,
        coinm: !!coinm,
        futuresStrategy,
        _ordersInAdvance: ordersInAdvance,
        useOrderInAdvance,
      },
      all,
      nosplice,
    )
  }

  getEstimateBalance(_grids: Grid[], number?: number) {
    const grids = _grids
      .filter((g) =>
        number
          ? this.settings.strategy === StrategyEnum.short
            ? g.side === 'BUY'
            : g.side === 'SELL'
          : true,
      )
      .slice(0, number ?? _grids.length)
    let res = { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } }
    if (this.settings.futures) {
      res = grids.reduce(
        (acc, grid) => {
          return {
            ...acc,
            buy: {
              qty: acc.buy.qty + grid.qty * grid.price,
              qtyBase: acc.buy.qtyBase + grid.qty,
            },
          }
        },
        { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } } as {
          sell: { qty: number; qtyQuote: number }
          buy: { qty: number; qtyBase: number }
        },
      ) || { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } }
      res.buy.qty /=
        this.settings.marginType !== BotMarginTypeEnum.inherit
          ? this.settings.leverage ?? 1
          : 1
      if (this.settings.coinm) {
        res = grids.reduce(
          (acc, grid) => {
            return {
              ...acc,
              sell: {
                qty: acc.sell.qty + grid.qty,
                qtyQuote: acc.sell.qtyQuote + grid.qty * grid.price,
              },
            }
          },
          {
            sell: { qty: 0, qtyQuote: 0 },
            buy: { qty: 0, qtyBase: 0 },
          } as {
            sell: { qty: number; qtyQuote: number }
            buy: { qty: number; qtyBase: number }
          },
        ) || { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } }
        res.sell.qty /=
          this.settings.marginType !== BotMarginTypeEnum.inherit
            ? this.settings.leverage ?? 1
            : 1
      }
    } else {
      res = grids.reduce(
        (acc, grid) => {
          if (grid.side && grid.side === 'SELL' && grid.qty) {
            return {
              ...acc,
              sell: {
                qty: acc.sell.qty + grid.qty,
                qtyQuote: acc.sell.qtyQuote + grid.qty * grid.price,
              },
            }
          }
          if (grid.side && grid.side === 'BUY' && grid.qty) {
            return {
              ...acc,
              buy: {
                qty: acc.buy.qty + grid.qty * grid.price,
                qtyBase: acc.buy.qtyBase + grid.qty,
              },
            }
          }
          return acc
        },
        { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } } as {
          sell: { qty: number; qtyQuote: number }
          buy: { qty: number; qtyBase: number }
        },
      ) || { sell: { qty: 0, qtyQuote: 0 }, buy: { qty: 0, qtyBase: 0 } }
    }
    const base = this.math.round(
      res.sell.qty,
      this.utils.getBaseAssetPrecision(this.symbol),
      false,
      true,
    )
    const quote = this.math.round(
      res.buy.qty,
      this.symbol.priceAssetPrecision,
      false,
      true,
    )
    return {
      base,
      quote,
    }
  }

  claculateProfit(orders: OrderData[]) {
    let profBase = 0
    let profQuote = 0
    let totalProfit = 0
    const tempOrders = orders
      .filter(
        (order) => order.status === 'FILLED' && order.typeOrder === 'regular',
      )
      .sort(
        (b, a) =>
          (b.updateTime || b.transactTime) - (a.updateTime || a.transactTime),
      )
    const top = parseFloat(`${this.settings.topPrice}`)
    const prices = this.getPrices()
    prices[prices.length - 1].buy = this.math.round(
      top,
      this.symbol.priceAssetPrecision,
    )
    const profitArray: {
      comBase: number
      comQuote: number
      profitBase: number
      profitQuote: number
      totalProfitBase: number
      totalProfitQuote: number
      matchedPrice: number
      matchedId: string
    }[] = []

    if (this.settings.profitCurrency === 'quote') {
      const grids = this.createOrders(true, true)
      tempOrders.map((o) => {
        const qty = parseFloat(o.origQty)
        const price = parseFloat(o.price)
        const comBase = qty * this.userFee
        const comQuote = qty * price * this.userFee
        let profitBase = 0
        let profitQuote = 0
        profBase -= comBase
        profQuote -= comQuote
        let matchedPrice = 0
        if (o.side === 'SELL') {
          let index = prices.findIndex((p) => p.sell === price)
          if (index === -1) {
            index = prices.findIndex((p) => p.buy === price)
          }
          const buyMatch = grids.find(
            (g) => g.price === prices[index - 1].buy && g.side === 'BUY',
          )
          if (buyMatch) {
            profitBase = buyMatch.qty - qty
            profitQuote =
              qty * price - buyMatch.qty * buyMatch.price + profitBase * price
            profBase += profitBase
            profQuote += profitQuote
            matchedPrice = buyMatch.price
          }
        }

        profitArray.push({
          comBase,
          comQuote,
          profitBase,
          profitQuote,
          totalProfitBase: profBase,
          totalProfitQuote: profQuote,
          matchedPrice,
          matchedId: '',
        })
      })
    }
    if (this.settings.profitCurrency === 'base') {
      const usedId: string[] = []
      tempOrders.map((o) => {
        const qty = parseFloat(o.origQty)
        const price = parseFloat(o.price)
        const comBase = qty * this.userFee
        const comQuote = qty * price * this.userFee
        let profitBase = 0
        let profitQuote = 0
        profBase -= comBase
        profQuote -= comQuote
        let matchedPrice = 0
        let matchedId = ''
        if (!usedId.includes(o.clientOrderId)) {
          let index = prices.findIndex(
            (p) => (o.side === 'SELL' ? p.sell : p.buy) === price,
          )
          if (index === -1) {
            index = prices.findIndex(
              (p) => (o.side === 'SELL' ? p.buy : p.sell) === price,
            )
          }
          const match = tempOrders.find(
            (g) =>
              parseFloat(g.price) ===
                (o.side === 'SELL'
                  ? prices[index - 1].buy
                  : prices[index + 1].sell) &&
              g.side !== o.side &&
              g.updateTime < o.updateTime &&
              !usedId.includes(g.clientOrderId),
          )
          if (match) {
            matchedId = match.clientOrderId
            usedId.push(matchedId)
            usedId.push(o.clientOrderId)
            const matchQty = parseFloat(match.origQty)
            matchedPrice = parseFloat(match.price)
            profitBase = o.side === 'SELL' ? matchQty - qty : qty - matchQty
            profitQuote =
              o.side === 'SELL'
                ? qty * price - matchQty * matchedPrice
                : matchQty * matchedPrice - qty * price
            profitQuote +=
              profitBase * (o.side === 'BUY' ? price : matchedPrice)
            profBase += profitBase
            profQuote += profitQuote
          }
        }

        profitArray.push({
          comBase,
          comQuote,
          profitBase,
          profitQuote,
          totalProfitBase: profBase,
          totalProfitQuote: profQuote,
          matchedPrice,
          matchedId,
        })
      })
    }
    profBase = this.math.round(profBase, 8)
    profQuote = this.math.round(profQuote, 8)
    totalProfit = this.math.round(
      (profQuote / parseFloat(`${this.settings.budget}`)) * 100,
      1,
    )
    return {
      base: profBase,
      quote: profQuote,
      total: totalProfit,
      profitArray,
    }
  }

  getBalancesOnPrice(lastPrice: string, inputOrders?: OrderData[]) {
    if (parseFloat(lastPrice) > 0) {
      let orders =
        inputOrders && inputOrders.length > 0
          ? inputOrders.map((o) => ({
              side: o.side,
              qty: parseFloat(o.origQty),
              price: parseFloat(o.price),
            }))
          : this.createOrders(true, false)
      if (inputOrders && inputOrders.length > 0) {
        const allGrids = this.createOrders(true, false)
        orders = orders.sort((a, b) => a.price - b.price)
        orders = [
          ...orders,
          ...allGrids.filter(
            (g) =>
              g.price < orders[0].price ||
              g.price > orders[orders.length - 1].price,
          ),
        ]
      }

      const base = this.math.round(
        orders
          .filter((o) => o.side === 'SELL')
          .reduce((acc, v) => (acc += v.qty), 0),
        12,
      )
      const quote = this.math.round(
        orders
          .filter((o) => o.side === 'BUY')
          .reduce((acc, v) => (acc += v.qty * v.price), 0),
        12,
      )
      return {
        base,
        quote,
      }
    }
    return {
      base: 0,
      quote: 0,
    }
  }
}

export default BotFunctions
