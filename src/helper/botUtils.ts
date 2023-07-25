import { MathHelper } from './math'
import { FuturesStrategyEnum, BotOrderSideEnum } from '../types'
import type { Symbols, GridType, Grid, Currency } from '../types'

class BotUtils {
  public math: MathHelper

  constructor() {
    this.math = new MathHelper()
  }

  getPrecision(symbol?: Symbols) {
    return {
      base: symbol ? this.getBaseAssetPrecision(symbol) : 8,
      quote: symbol
        ? this.math.getPrecision(
            symbol.quoteAsset.minAmount || symbol.baseAsset.minAmount,
            true,
          )
        : 8,
      price: symbol ? symbol.priceAssetPrecision : 8,
    }
  }

  getBaseAssetPrecision(symbol: Symbols) {
    let use = `${symbol.baseAsset.step}`
    if (use.indexOf('e-') !== -1) {
      const split = use.split('e-')[1]
      use = Number(symbol.baseAsset.step).toFixed(parseFloat(split))
    }
    if (use.indexOf('1') === -1) {
      const dec = use.replace('0.', '')
      const numbers = dec.replace(/0/g, '')
      const place = dec.indexOf(numbers)
      if (place <= 1) {
        return place
      }
      use = `0.${'0'.repeat(place)}1`
    }
    return use.indexOf('1') === 0 ? 0 : use.replace('0.', '').indexOf('1') + 1
  }

  id(length: number): string {
    let result = ''
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }

  getPrices({
    lowPrice,
    topPrice,
    levels,
    symbol,
    sellDisplacement,
    gridType,
  }: {
    lowPrice: string
    topPrice: string
    levels: string
    symbol: Symbols
    sellDisplacement: string
    gridType: GridType
  }) {
    const low = parseFloat(lowPrice)
    const top = parseFloat(topPrice)
    const newGS = (top / low) ** (1 / parseFloat(levels)) - 1
    const prices: { buy: number; sell: number }[] = []
    let sellD = parseFloat(sellDisplacement)
    sellD = isNaN(sellD) ? 0 : sellD / 100
    if (gridType === 'arithmetic') {
      const step = (top - low) / parseFloat(levels)
      for (let i = 0; i <= parseFloat(levels); i++) {
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

  getSellBuyCount(
    prices: ReturnType<typeof this.getPrices>,
    {
      useStartPrice,
      startPrice,
      forceLocal,
      initialPrice,
      levels,
    }: {
      useStartPrice?: boolean
      startPrice?: string
      forceLocal: boolean
      initialPrice: number
      levels: number
    },
  ) {
    const useStart =
      !forceLocal &&
      useStartPrice &&
      startPrice &&
      startPrice !== '' &&
      startPrice !== '0'
    const initPrice = useStart ? +startPrice : +initialPrice

    const sells = prices.filter((p) => p.sell > initPrice)
    const buys = prices.filter((p) => p.buy < initPrice)
    let sellCount = sells.length
    let buyCount = buys.length
    if (sellCount > 0 && buyCount > 0) {
      if (
        Math.abs(sells[0].sell - initPrice) >
        Math.abs(buys[buys.length - 1].buy - initPrice)
      ) {
        buys.splice(buys.length - 1, 1)
      } else {
        sells.splice(0, 1)
      }
    }
    if (sellCount > 0 && buyCount === 0 && sellCount > levels) {
      sells.splice(0, 1)
    }
    if (buyCount > 0 && sellCount === 0 && buyCount > levels) {
      buys.splice(buys.length - 1, 1)
    }
    sellCount = sells.length
    buyCount = buys.length
    return { sellCount, buyCount, buys, sells }
  }

  findClosestGrids(
    {
      lowPrice,
      topPrice,
      levels,
      symbol,
      sellDisplacement,
      gridType,
      _ordersInAdvance,
      useOrderInAdvance,
    }: {
      _ordersInAdvance?: string
      useOrderInAdvance: boolean
      lowPrice: string
      topPrice: string
      levels: string
      symbol: Symbols
      sellDisplacement: string
      gridType: GridType
    },
    grids: Grid[],
    latestPrice: number,
    n?: number,
  ) {
    if ((_ordersInAdvance && useOrderInAdvance) || n) {
      let arrayResult: Grid[] = []
      let copyArray = [...grids].sort((a, b) => a.price - b.price)
      const ordersInAdvance =
        n || (_ordersInAdvance ? parseInt(_ordersInAdvance) : 0)
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
      const prices = this.getPrices({
        lowPrice,
        topPrice,
        levels,
        symbol,
        sellDisplacement,
        gridType,
      })
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

  createGridOrders(
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
      _latestPrice,
      userFee,
      sellDisplacement,
      gridType,
      initialPrice,
      futures,
      profitCurrency,
      orderFixedIn,
      coinm,
      futuresStrategy,
      _ordersInAdvance,
      useOrderInAdvance,
      combo,
    }: {
      lowPrice: string
      topPrice: string
      budget: string
      levels: string
      useStartPrice?: boolean
      startPrice?: string
      updatedBudget?: boolean
      forceLocal: boolean
      symbol: Symbols
      _latestPrice: number
      userFee: number
      sellDisplacement: string
      gridType: GridType
      initialPrice: number
      futures: boolean
      profitCurrency: Currency
      orderFixedIn: Currency
      coinm: boolean
      futuresStrategy?: FuturesStrategyEnum
      _ordersInAdvance?: string
      useOrderInAdvance: boolean
      combo?: boolean
    },
    all = false,
    nosplice = false,
    feeToSell = false,
  ): Grid[] {
    const useStart =
      !forceLocal &&
      useStartPrice &&
      startPrice &&
      startPrice !== '' &&
      startPrice !== '0'
    const latestPrice = useStart ? +startPrice : _latestPrice
    const low = parseFloat(lowPrice)
    const top = parseFloat(topPrice)
    const B = updatedBudget ? +budget : parseFloat(budget) / (1 + userFee * 100)
    const f = 1 + userFee
    let grids: Grid[] = []
    const quotedAssetPrecision = this.getBaseAssetPrecision(symbol)
    let qty = 0
    let buyQty = 0
    let sellQty = 0
    let quoteAmount = 0
    let baseAmount = 0
    const prices = this.getPrices({
      lowPrice,
      topPrice,
      levels,
      symbol,
      sellDisplacement,
      gridType,
    })
    const gs = (top / low) ** (1 / parseFloat(levels)) - 1
    const { sellCount, buyCount, buys, sells } = this.getSellBuyCount(prices, {
      useStartPrice,
      startPrice,
      forceLocal,
      initialPrice,
      levels: +levels,
    })
    const initPrice = useStart ? +startPrice : initialPrice
    if (profitCurrency === 'base') {
      if (orderFixedIn === 'base') {
        let tempSellQty = this.math.round(
          B /
            (initPrice * sellCount +
              buys.reduce((acc, v) => (acc += v.buy), 0) * (1 + gs)),
          quotedAssetPrecision,
          true,
        )
        if (tempSellQty < symbol.quoteAsset.minAmount / prices[0].buy) {
          tempSellQty = this.math.round(
            (symbol.quoteAsset.minAmount * 1.1) / prices[0].buy,
            quotedAssetPrecision,
            false,
            true,
          )
        }
        sellQty = tempSellQty
        if (sellQty < symbol.baseAsset.minAmount) {
          sellQty = symbol.baseAsset.minAmount
        }
        buyQty = this.math.round(
          tempSellQty * (1 + gs) * f,
          quotedAssetPrecision,
          false,
          true,
        )
        if (buyQty < symbol.baseAsset.minAmount) {
          buyQty = this.math.round(
            symbol.baseAsset.minAmount * f,
            quotedAssetPrecision,
            false,
            true,
          )
        }
      }
    }
    if (
      (profitCurrency === 'quote' && orderFixedIn === 'quote') ||
      (profitCurrency === 'base' && orderFixedIn === 'quote')
    ) {
      quoteAmount =
        B /
        (sells.reduce((acc, v) => (acc += 1 / v.sell), 0) * initPrice +
          buyCount * f)
      if (quoteAmount < symbol.quoteAsset.minAmount) {
        quoteAmount = symbol.quoteAsset.minAmount * f
      }
    }
    if (profitCurrency === 'quote') {
      if (orderFixedIn === 'base') {
        const lowest = [...prices].sort((a, b) => a.buy - b.buy)[0]?.buy || 0
        baseAmount = futures
          ? B /
            (buys.reduce((acc, v) => acc + v.buy, 0) +
              sells.reduce((acc, v) => acc + v.sell, 0))
          : B /
            (sellCount * initPrice + buys.reduce((acc, v) => acc + v.buy, 0))
        const round = this.math.round(baseAmount, quotedAssetPrecision, combo)
        if (round < symbol.quoteAsset.minAmount / lowest) {
          baseAmount = this.math.round(
            symbol.quoteAsset.minAmount / lowest,
            quotedAssetPrecision,
            false,
            true,
          )
        }
      }
    }
    if (coinm) {
      baseAmount = B / +levels
    }
    prices.map((pr, i) => {
      const side =
        pr.buy > latestPrice ? BotOrderSideEnum.sell : BotOrderSideEnum.buy
      const p = side === BotOrderSideEnum.buy ? pr.buy : pr.sell
      const same =
        profitCurrency === orderFixedIn ||
        (profitCurrency === 'base' && orderFixedIn === 'quote')
      if (profitCurrency === 'base') {
        if (orderFixedIn === 'quote') {
          buyQty = this.math.round(
            (quoteAmount / p) * f,
            quotedAssetPrecision,
            false,
            !futures,
          )
          if (buyQty < symbol.baseAsset.minAmount) {
            buyQty = this.math.round(
              symbol.baseAsset.minAmount * f,
              quotedAssetPrecision,
              false,
              !futures,
            )
          }
          if (i !== 0) {
            const prevBuyQty = this.math.round(
              quoteAmount / prices[i - 1].buy,
              quotedAssetPrecision,
              false,
              !futures,
            )
            sellQty = this.math.round(
              (prevBuyQty * prices[i - 1].buy) / p,
              quotedAssetPrecision,
            )
            if (prevBuyQty - sellQty < symbol.baseAsset.step) {
              sellQty = this.math.round(
                prevBuyQty - symbol.baseAsset.step,
                quotedAssetPrecision,
              )
            }
            if (sellQty < symbol.baseAsset.minAmount) {
              sellQty = symbol.baseAsset.minAmount
            }
          }
        }
      }
      if (profitCurrency === 'quote') {
        if (orderFixedIn === 'quote') {
          buyQty = this.math.round(
            (quoteAmount / p) * (feeToSell ? 1 : f),
            quotedAssetPrecision,
            !futures && feeToSell,
            !futures,
          )
          if (buyQty * p < symbol.quoteAsset.minAmount) {
            buyQty = this.math.round(
              (symbol.quoteAsset.minAmount / p) * (feeToSell ? 1 : f),
              quotedAssetPrecision,
              !futures && feeToSell,
              !futures,
            )
          }
          if (buyQty < symbol.baseAsset.minAmount) {
            buyQty = this.math.round(
              symbol.baseAsset.minAmount * (feeToSell ? 1 : f),
              quotedAssetPrecision,
              !futures && feeToSell,
              !futures,
            )
          }
          if (i !== 0) {
            sellQty = this.math.round(
              (quoteAmount / prices[i - 1].buy) * (feeToSell ? 2 - f : 1),
              quotedAssetPrecision,
              !futures,
            )
            if (sellQty * p < symbol.quoteAsset.minAmount) {
              sellQty = this.math.round(
                (symbol.quoteAsset.minAmount / prices[i - 1].buy) *
                  (feeToSell ? 2 - f : 1),
                quotedAssetPrecision,
                !futures,
              )
            }
          } else {
            sellQty = this.math.round(
              ((buyQty * (1 + gs)) / (feeToSell ? 1 : f)) *
                (feeToSell ? 2 - f : 1),
              quotedAssetPrecision,
              !futures,
            )
          }
          if (sellQty < symbol.baseAsset.minAmount) {
            sellQty = symbol.baseAsset.minAmount
          }
        }
      }
      if (profitCurrency === 'quote') {
        if (orderFixedIn === 'base') {
          qty = this.math.round(
            baseAmount,
            quotedAssetPrecision,
            combo,
            !futures,
          )
        }
      }
      if (coinm) {
        qty = this.math.round(baseAmount, quotedAssetPrecision)
      }

      if (qty < symbol.baseAsset.minAmount) {
        qty = symbol.baseAsset.minAmount
      }
      if (side === 'BUY' && !futures) {
        qty = this.math.round(qty * f, quotedAssetPrecision, false, !futures)
      }
      let gridQty = same ? (side === 'SELL' ? sellQty : buyQty) : qty
      const mod = this.math.remainder(gridQty, symbol.baseAsset.step)
      if (mod > Number.EPSILON) {
        gridQty = this.math.round(
          gridQty - mod + symbol.baseAsset.step,
          quotedAssetPrecision,
          false,
          true,
        )
      }
      const grid = {
        price: p,
        side,
        qty: gridQty,
        id: this.id(20),
      }
      if (grid.qty * grid.price < symbol.quoteAsset.minAmount) {
        grid.qty = this.math.round(
          symbol.quoteAsset.minAmount / grid.price,
          quotedAssetPrecision,
          false,
          true,
        )
      }
      if (grid.qty < symbol.baseAsset.minAmount) {
        grid.qty = symbol.baseAsset.minAmount
      }
      if (coinm) {
        const cont = (grid.price * grid.qty) / symbol.quoteAsset.minAmount
        if (cont < 1) {
          grid.qty = this.math.round(
            symbol.quoteAsset.minAmount / grid.price,
            quotedAssetPrecision,
            false,
            true,
          )
        } else if (cont % 1 > Number.EPSILON) {
          grid.qty = this.math.round(
            (this.math.round(cont, 0) * symbol.quoteAsset.minAmount) /
              grid.price,
            quotedAssetPrecision,
            false,
            true,
          )
        }
      }
      grids.push(grid)
    })
    if (!nosplice) {
      /** find nearest grid to latest price */
      let diff = Infinity
      let gridIndex = -1
      grids.map((grid, index) => {
        if (Math.abs(grid.price - latestPrice) < diff) {
          diff = Math.abs(grid.price - latestPrice)
          gridIndex = index
        }
      })
      /** remove nearest */
      grids.splice(gridIndex, 1)
    }
    if (!all) {
      if (
        futures &&
        futuresStrategy &&
        futuresStrategy !== FuturesStrategyEnum.neutral
      ) {
        const fullGrids = grids
        grids = [
          ...this.findClosestGrids(
            {
              lowPrice,
              topPrice,
              levels,
              symbol,
              sellDisplacement,
              gridType,
              _ordersInAdvance,
              useOrderInAdvance,
            },
            grids,
            latestPrice,
            undefined,
          ).filter(
            (g) =>
              g.side !==
              (futuresStrategy === FuturesStrategyEnum.long
                ? BotOrderSideEnum.sell
                : BotOrderSideEnum.buy),
          ),
          ...fullGrids.filter(
            (g) =>
              g.side ===
              (futuresStrategy === FuturesStrategyEnum.long
                ? BotOrderSideEnum.sell
                : BotOrderSideEnum.buy),
          ),
        ]
      } else {
        grids = this.findClosestGrids(
          {
            lowPrice,
            topPrice,
            levels,
            symbol,
            sellDisplacement,
            gridType,
            _ordersInAdvance,
            useOrderInAdvance,
          },
          grids,
          latestPrice,
          undefined,
        )
      }
    }
    return grids.sort((a, b) => a.price - b.price)
  }
}

export default BotUtils
