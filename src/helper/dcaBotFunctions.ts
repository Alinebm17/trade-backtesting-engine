import {
  BotOrderSideEnum,
  StrategyEnum,
  OrderSizeTypeEnum,
  DCAOrderTypeEnum,
  GridBreakpoint,
  CloseConditionEnum,
  TerminalDealTypeEnum,
  DCAConditionEnum,
  IndicatorAction,
} from '../types'
import BotUtils from './botUtils'
import { checkNumber } from './utils'

import type { DCABotSettings, Symbols, DCAGrid, Asset } from '../types'

class DCABotFunctions {
  math: BotUtils['math']

  settings: DCABotSettings

  symbol: Symbols

  utils: BotUtils

  userFee: number

  constructor(
    settings: DCABotSettings,
    symbol: Symbols,
    userFee: number,
    tradesBacktest?: boolean,
  ) {
    this.settings = settings
    this.symbol = symbol
    this.utils = new BotUtils(tradesBacktest)
    this.math = this.utils.math
    this.userFee = userFee
  }

  set sett(settings: Partial<DCABotSettings>) {
    this.settings = {
      ...this.settings,
      ...settings,
    }
  }

  get sett() {
    return this.settings
  }

  set sym(symbol: Symbols) {
    this.symbol = symbol
  }

  set all(data: { settings: DCABotSettings; symbol: Symbols }) {
    this.settings = data.settings
    this.symbol = data.symbol
  }

  get isTrailingTp() {
    const { trailingTp, trailingTpPerc, tpPerc, useTp } = this.settings
    return (
      useTp && checkNumber(tpPerc) && trailingTp && checkNumber(trailingTpPerc)
    )
  }

  get isTrailingSl() {
    const { trailingSl, slPerc, useSl } = this.settings
    return useSl && trailingSl && checkNumber(slPerc)
  }

  createOrders(
    inputLatestPrice: number,
    all = false,
    precOrderSize = 0,
    breakpoints: GridBreakpoint[] = [],
    balances: Asset[] | null = [],
    outsideSl = false,
    tpSlTargetFilled: string[] = [],
  ): DCAGrid[] {
    const { settings, symbol } = this
    const baseOrderSize = parseFloat(settings.baseOrderSize)
    const _orderSize = parseFloat(settings.orderSize)
    const tpPerc = parseFloat(settings.tpPerc) / 100
    const slPerc = parseFloat(settings.slPerc) / 100
    const precision = this.utils.getBaseAssetPrecision(symbol)
    const step = parseFloat(settings.step) / 100
    const stepScale = parseFloat(settings.stepScale)
    const volumeScale = parseFloat(settings.volumeScale)
    let minOpenDeal = parseFloat(settings.minOpenDeal || '0')
    let maxOpenDeal = parseFloat(settings.maxOpenDeal || '0')
    minOpenDeal = isNaN(minOpenDeal) ? 0 : minOpenDeal
    maxOpenDeal = isNaN(maxOpenDeal) ? 0 : maxOpenDeal
    const {
      activeOrdersCount,
      useTp: _useTp,
      dealCloseCondition,
      useSmartOrders,
      useSl: _useSl,
      dealCloseConditionSL,
      orderSizeType,
      coinm,
    } = settings
    const useTp = _useTp && dealCloseCondition === CloseConditionEnum.tp
    const useSl = _useSl && dealCloseConditionSL === CloseConditionEnum.tp
    const latestPrice = this.math.round(
      inputLatestPrice,
      symbol.priceAssetPrecision,
    )
    if (
      (minOpenDeal !== 0 && latestPrice <= minOpenDeal) ||
      (maxOpenDeal !== 0 && latestPrice >= maxOpenDeal)
    ) {
      return []
    }
    let baseQty =
      orderSizeType === OrderSizeTypeEnum.base
        ? this.math.round(baseOrderSize, precision, true)
        : orderSizeType === OrderSizeTypeEnum.quote
        ? this.math.round(
            (baseOrderSize * (coinm ? symbol.quoteAsset.minAmount : 1)) /
              latestPrice,
            precision,
            true,
          )
        : this.math.round(
            symbol.quoteAsset.minAmount
              ? symbol.quoteAsset.minAmount / latestPrice
              : symbol.baseAsset.minAmount,
            precision,
            true,
          )
    let qtyToUse = 0
    if (
      orderSizeType === OrderSizeTypeEnum.percFree ||
      orderSizeType === OrderSizeTypeEnum.percTotal
    ) {
      const findBalance = (balances ?? []).find(
        (b) =>
          b.asset ===
          (settings.futures
            ? settings.coinm
              ? symbol.baseAsset.name
              : symbol.quoteAsset.name
            : settings.terminalDealType === TerminalDealTypeEnum.import
            ? settings.strategy === StrategyEnum.long
              ? symbol.baseAsset.name
              : symbol.quoteAsset.name
            : settings.strategy === StrategyEnum.short
            ? symbol.baseAsset.name
            : symbol.quoteAsset.name),
      )
      qtyToUse = findBalance
        ? orderSizeType === OrderSizeTypeEnum.percFree
          ? +findBalance.free
          : +findBalance.locked + +findBalance.free
        : 0
      baseQty = this.math.round(
        Math.max(
          symbol.quoteAsset.minAmount
            ? symbol.quoteAsset.minAmount / latestPrice
            : symbol.baseAsset.minAmount,
          (qtyToUse * (baseOrderSize / 100)) /
            (settings.futures
              ? settings.coinm
                ? 1
                : latestPrice
              : settings.terminalDealType === TerminalDealTypeEnum.import
              ? settings.strategy === StrategyEnum.long
                ? 1
                : latestPrice
              : settings.strategy === StrategyEnum.short
              ? 1
              : latestPrice),
        ),
        precision,
        true,
      )
    }
    const long = settings.strategy === StrategyEnum.long
    const ordersSide = long ? BotOrderSideEnum.buy : BotOrderSideEnum.sell
    let tpPrice = this.math.round(
      latestPrice *
        (1 + (settings.strategy === StrategyEnum.long ? 1 : -1) * tpPerc),
      symbol.priceAssetPrecision,
    )
    if (tpPrice === latestPrice) {
      tpPrice = this.math.round(
        latestPrice +
          (settings.strategy === StrategyEnum.long ? 1 : -1) *
            Number(`${1}e-${symbol.priceAssetPrecision}`),
        symbol.priceAssetPrecision,
      )
    }
    const baseOrder: DCAGrid = {
      qty: baseQty,
      price: latestPrice,
      type: DCAOrderTypeEnum.bo,
      side: ordersSide,
      id: this.utils.id(20),
      priceDeviation: '0%',
      avgPrice: latestPrice,
      requiredPrice: useTp ? tpPrice : undefined,
      levelNumber: 0,
    }
    if (baseOrder.price * baseOrder.qty < symbol.quoteAsset.minAmount) {
      baseOrder.qty = this.math.round(
        symbol.quoteAsset.minAmount / baseOrder.price,
        precision,
        false,
        true,
      )
    }
    if (settings.coinm) {
      const cont =
        (baseOrder.price * baseOrder.qty) / symbol.quoteAsset.minAmount
      if (cont < 1) {
        baseOrder.qty = this.math.round(
          symbol.quoteAsset.minAmount / baseOrder.price,
          precision,
          false,
          true,
        )
      } else if (cont % 1 > Number.EPSILON) {
        baseOrder.qty = this.math.round(
          (this.math.round(cont, 0) * symbol.quoteAsset.minAmount) /
            baseOrder.price,
          precision,
          false,
          true,
        )
      }
    }
    const mod = baseOrder.qty % symbol.baseAsset.step
    if (mod > Number.EPSILON) {
      baseOrder.qty = this.math.round(
        baseOrder.qty - mod + symbol.baseAsset.step,
        precision,
        false,
        true,
      )
    }
    baseOrder.base = baseOrder.qty
    baseOrder.quote = this.math.round(
      baseOrder.qty * latestPrice,
      symbol.priceAssetPrecision,
    )
    const tpOrder: DCAGrid = {
      qty: baseOrder.qty,
      price: tpPrice,
      type: DCAOrderTypeEnum.tp,
      side:
        settings.strategy === StrategyEnum.long
          ? BotOrderSideEnum.sell
          : BotOrderSideEnum.buy,
      id: this.utils.id(20),
    }
    if (tpOrder.price * tpOrder.qty < symbol.quoteAsset.minAmount) {
      tpOrder.qty = this.math.round(
        symbol.quoteAsset.minAmount / tpOrder.price,
        precision,
        false,
        true,
      )
    }
    let tpOrders = [tpOrder]
    if (settings.useMultiTp) {
      let restQty = tpOrder.qty
      let end = false
      tpOrders = []
      ;[...(settings.multiTp ?? [])]
        .sort((a, b) => +a.target - +b.target)
        .map((tp) => {
          if (end) {
            return null
          }
          let price = this.math.round(
            latestPrice *
              (1 +
                (settings.strategy === StrategyEnum.long ? 1 : -1) *
                  (+tp.target / 100)),
            symbol.priceAssetPrecision,
          )
          if (price === latestPrice) {
            price = this.math.round(
              latestPrice +
                (settings.strategy === StrategyEnum.long ? 1 : -1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
          let qty = this.math.round(
            baseOrder.qty * (+tp.amount / 100),
            precision,
            true,
          )
          if (qty > restQty) {
            qty = this.math.round(restQty, precision, true)
          }
          if (qty < symbol.baseAsset.minAmount) {
            qty = this.math.round(symbol.baseAsset.minAmount, precision, true)
          }
          if (price * qty < symbol.quoteAsset.minAmount) {
            qty = this.math.round(
              symbol.quoteAsset.minAmount / price,
              precision,
              true,
            )
          }

          const modQty = this.math.remainder(qty, symbol.baseAsset.step)
          if (modQty !== 0) {
            qty = this.math.round(
              qty - modQty + symbol.baseAsset.step,
              precision,
              true,
            )
          }
          restQty -= qty
          if (
            restQty < symbol.baseAsset.minAmount ||
            restQty * price < symbol.quoteAsset.minAmount ||
            restQty < 0
          ) {
            end = true
            qty =
              restQty > 0 && restQty > symbol.baseAsset.step
                ? this.math.round(qty + restQty, precision, true)
                : qty
          }

          return {
            ...tpOrder,
            qty,
            price,
            id: this.utils.id(20),
            label: `TP order ${
              (settings.multiTp ?? []).findIndex((fi) => tp.uuid === fi.uuid) +
              1
            }`,
            tpSlTarget: tp.uuid,
          }
        })
        .forEach((o) => {
          if (o) {
            tpOrders.push(o)
          }
        })
    }
    const slOrder: DCAGrid = {
      ...tpOrder,
      price: this.math.round(
        latestPrice *
          (1 + (settings.strategy === StrategyEnum.long ? 1 : -1) * slPerc),
        symbol.priceAssetPrecision,
      ),
      type: DCAOrderTypeEnum.sl,
      id: this.utils.id(20),
    }
    let slOrders = [slOrder]
    if (settings.useMultiSl) {
      let restQty = slOrder.qty
      let end = false
      slOrders = []
      ;[...(settings.multiSl ?? [])]
        .sort((a, b) => +b.target - +a.target)
        .filter((tp) => !(tpSlTargetFilled ?? []).includes(tp.uuid))
        .map((tp) => {
          if (end) {
            return null
          }
          let price = this.math.round(
            latestPrice *
              (1 +
                (settings.strategy === StrategyEnum.long ? 1 : -1) *
                  (+tp.target / 100)),
            symbol.priceAssetPrecision,
          )
          if (price === latestPrice) {
            price = this.math.round(
              latestPrice +
                (settings.strategy === StrategyEnum.long ? 1 : -1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
          let qty = this.math.round(
            baseOrder.qty * (+tp.amount / 100),
            precision,
            true,
          )
          if (qty > restQty) {
            qty = this.math.round(restQty, precision, true)
          }
          if (qty < symbol.baseAsset.minAmount) {
            qty = this.math.round(symbol.baseAsset.minAmount, precision, true)
          }
          if (price * qty < symbol.quoteAsset.minAmount) {
            qty = this.math.round(
              symbol.quoteAsset.minAmount / price,
              precision,
              true,
            )
          }

          const modQty = this.math.remainder(qty, symbol.baseAsset.step)
          if (modQty !== 0) {
            qty = this.math.round(
              qty - modQty + symbol.baseAsset.step,
              precision,
              true,
            )
          }
          restQty -= qty

          if (
            restQty < symbol.baseAsset.minAmount ||
            restQty * price < symbol.quoteAsset.minAmount ||
            restQty < 0
          ) {
            end = true
            qty =
              restQty > 0 && restQty > symbol.baseAsset.step
                ? this.math.round(qty + restQty, precision, true)
                : qty
          }

          return {
            ...slOrder,
            qty,
            price,
            id: this.utils.id(20),
            label: `SL order ${
              (settings.multiSl ?? []).findIndex((fi) => tp.uuid === fi.uuid) +
              1
            }`,
            tpSlTarget: tp.uuid,
          }
        })
        .forEach((o) => {
          if (o) {
            slOrders.push(o)
          }
        })
    }
    if (settings.profitCurrency === 'base') {
      const qty = this.math.round(
        (baseOrder.qty * latestPrice) / tpOrder.price,
        precision,
      )
      tpOrder.qty =
        settings.strategy === StrategyEnum.long
          ? Math.min(tpOrder.qty, qty)
          : Math.max(tpOrder.qty, qty)
    }
    const gridStep = latestPrice * step
    let orders: DCAGrid[] = []
    if (settings.useDca) {
      const ordersCount =
        settings.dcaCondition === DCAConditionEnum.indicators
          ? settings.indicators.filter(
              (i) => i.indicatorAction === IndicatorAction.startDca,
            ).length
          : parseInt(`${settings.ordersCount}`)
      for (let i = 1; i <= ordersCount; i++) {
        const stepVal =
          settings.dcaCondition === DCAConditionEnum.indicators
            ? 1
            : stepScale ** (i - 1)
        const volumeVal =
          settings.dcaCondition === DCAConditionEnum.indicators
            ? 1
            : volumeScale ** (i - 1)
        let price = this.math.round(
          (i === 1 ? latestPrice : orders[orders.length - 1].price) -
            (settings.strategy === StrategyEnum.long ? 1 : -1) *
              gridStep *
              stepVal,
          symbol.priceAssetPrecision,
        )
        if (settings.dcaCondition === DCAConditionEnum.indicators) {
          const indicatorValue =
            +(
              settings.indicators.filter(
                (ind) => ind.indicatorAction === IndicatorAction.startDca,
              )[i - 1]?.minPercFromLast ?? '100'
            ) / 100
          price = this.math.round(
            (i === 1 ? latestPrice : orders[orders.length - 1].price) *
              (settings.strategy === StrategyEnum.long
                ? 1 - indicatorValue
                : 1 + indicatorValue),

            symbol.priceAssetPrecision,
          )
        }
        if (i === 1) {
          if (price === baseOrder.price) {
            price = this.math.round(
              baseOrder.price +
                (settings.strategy === StrategyEnum.long ? -1 : 1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
        }
        if (i > 1) {
          if (price === orders[orders.length - 1].price) {
            price = this.math.round(
              orders[orders.length - 1].price +
                (settings.strategy === StrategyEnum.long ? -1 : 1) *
                  Number(`${1}e-${symbol.priceAssetPrecision}`),
              symbol.priceAssetPrecision,
            )
          }
        }
        if (price <= 0) {
          break
        }
        const findBreakpoint = breakpoints
          .sort((a, b) => (long ? b.price - a.price : a.price - b.price))
          .find((b) => b.price === price)
        if (findBreakpoint) {
          price = this.math.round(
            findBreakpoint.displacedPrice,
            symbol.priceAssetPrecision,
          )
        }
        let orderSize = _orderSize
        if (settings.dcaCondition === DCAConditionEnum.indicators) {
          orderSize =
            +(
              settings.indicators.filter(
                (ind) => ind.indicatorAction === IndicatorAction.startDca,
              )[i - 1]?.orderSize ?? '0'
            ) || _orderSize
        }
        let qty =
          orderSizeType === OrderSizeTypeEnum.quote
            ? this.math.round(
                ((orderSize * (coinm ? symbol.quoteAsset.minAmount : 1)) /
                  price) *
                  volumeVal,
                precision,
              )
            : orderSizeType === OrderSizeTypeEnum.base
            ? this.math.round(orderSize * volumeVal, precision)
            : orderSizeType === OrderSizeTypeEnum.percFree ||
              orderSizeType === OrderSizeTypeEnum.percTotal
            ? precOrderSize !== 0
              ? this.math.round(precOrderSize * volumeVal, precision)
              : this.math.round(
                  ((qtyToUse * (+orderSize / 100)) /
                    (settings.futures
                      ? settings.coinm
                        ? 1
                        : latestPrice
                      : settings.terminalDealType ===
                        TerminalDealTypeEnum.import
                      ? settings.strategy === StrategyEnum.long
                        ? 1
                        : latestPrice
                      : settings.strategy === StrategyEnum.short
                      ? 1
                      : latestPrice)) *
                    volumeVal,
                  precision,
                )
            : this.math.round(
                Math.max(
                  symbol.quoteAsset.minAmount
                    ? symbol.quoteAsset.minAmount / latestPrice
                    : symbol.baseAsset.minAmount,
                  (qtyToUse * orderSize) / 100 / latestPrice,
                ),
                precision,
              )
        if (qty < symbol.baseAsset.minAmount) {
          qty = symbol.baseAsset.minAmount
        }
        if (price * qty < symbol.quoteAsset.minAmount) {
          qty = this.math.round(
            symbol.quoteAsset.minAmount / price,
            precision,
            false,
            true,
          )
        }
        if (settings.coinm) {
          const cont = (price * qty) / symbol.quoteAsset.minAmount
          if (cont < 1) {
            qty = this.math.round(
              symbol.quoteAsset.minAmount / price,
              precision,
              false,
              true,
            )
          } else if (cont % 1 > Number.EPSILON) {
            qty = this.math.round(
              (this.math.round(cont, 0) * symbol.quoteAsset.minAmount) / price,
              precision,
              false,
              true,
            )
          }
        }
        const modQty = qty % symbol.baseAsset.step
        if (modQty !== 0) {
          qty = this.math.round(
            qty - modQty + symbol.baseAsset.step,
            precision,
            false,
            true,
          )
        }
        const base =
          baseOrder.qty + orders.reduce((acc, v) => acc + v.qty, 0) + qty
        const quote =
          baseOrder.price * baseOrder.qty +
          orders.reduce((acc, v) => acc + v.price * v.qty, 0) +
          qty * price
        const avgPrice = this.math.round(
          quote / base,
          symbol.priceAssetPrecision,
        )
        orders.push({
          qty,
          price,
          type: DCAOrderTypeEnum.dca,
          side: ordersSide,
          id: this.utils.id(20),
          priceDeviation: `${this.math.round(
            ((latestPrice - price) / latestPrice) * 100,
            0,
          )}%`,
          avgPrice,
          requiredPrice: useTp
            ? this.math.round(
                avgPrice * (1 + tpPerc),
                symbol.priceAssetPrecision,
              )
            : undefined,
          note:
            price < 0
              ? `This order won't be placed, because price deviation more than 100%`
              : qty * price < symbol.quoteAsset.minAmount
              ? `This order won't be placed, because order amount is less than min allowed by the exchange: ${symbol.quoteAsset.minAmount} ${symbol.quoteAsset.name}`
              : '',
          base: this.math.round(base, precision),
          quote: this.math.round(quote, symbol.priceAssetPrecision),
          levelNumber: i,
        })
      }
      if (!all && useSmartOrders) {
        orders = [
          ...orders
            .sort((a, b) =>
              settings.strategy === StrategyEnum.long
                ? b.price - a.price
                : a.price - b.price,
            )
            .slice(0, parseInt(`${activeOrdersCount}`)),
        ]
      }
    }
    const result = [...orders, baseOrder, ...tpOrders, ...slOrders]
      .filter(
        (o) =>
          (!useTp ? o.type !== DCAOrderTypeEnum.tp : true) &&
          (!useSl ? o.type !== DCAOrderTypeEnum.sl : true),
      )
      .flat()
      .sort((a, b) =>
        settings.strategy === StrategyEnum.long
          ? b.price - a.price
          : a.price - b.price,
      )
    const useOutsideSl = this.settings.useSl && !this.settings.moveSL
    if (useOutsideSl && outsideSl) {
      const slLevel = result
        .filter((o) => o.type === DCAOrderTypeEnum.sl)
        .sort((a, b) =>
          long ? b.price - a.price : a.price - b.price,
        )[0]?.price
      if (slLevel) {
        return result.filter((r) => {
          return r.type === DCAOrderTypeEnum.dca
            ? long
              ? r.price > slLevel
              : r.price < slLevel
            : true
        })
      }
    }
    return result
  }

  getSLOrder(
    slPerc: number,
    breakeven: number,
    all = false,
    precOrderSize = 0,
    breakpoints: GridBreakpoint[] = [],
    balances: Asset[] | null = [],
    outsideSl = false,
    tpSlTargetFilled: string[] = [],
  ) {
    let unsetTP = false
    let closeCondition = this.settings.dealCloseCondition
    let changeSl = false
    let unsetSl = false
    let closeConditionSl = this.settings.dealCloseConditionSL
    const sl = this.settings.slPerc
    if (+this.settings.slPerc !== slPerc) {
      this.settings.slPerc = `${slPerc}`
      changeSl = true
    }
    if (!this.settings.useTp) {
      unsetTP = true
      this.settings.useTp = true
      if (closeCondition !== CloseConditionEnum.tp) {
        closeCondition = this.settings.dealCloseCondition
        this.settings.dealCloseCondition = CloseConditionEnum.tp
      }
    }
    if (!this.settings.useSl) {
      unsetSl = true
      this.settings.useSl = true
      if (closeCondition !== CloseConditionEnum.tp) {
        closeConditionSl = this.settings.dealCloseConditionSL
        this.settings.dealCloseConditionSL = CloseConditionEnum.tp
      }
    }
    const orders = this.createOrders(
      breakeven,
      all,
      precOrderSize,
      breakpoints,
      balances,
      outsideSl,
      tpSlTargetFilled,
    )
    const slOrders = orders.filter((o) => o.type === DCAOrderTypeEnum.sl)
    if (unsetTP) {
      this.settings.useTp = false
      if (closeCondition !== this.settings.dealCloseCondition) {
        this.settings.dealCloseCondition = closeCondition
      }
    }
    if (unsetSl) {
      this.settings.useSl = false
      if (closeConditionSl !== this.settings.dealCloseConditionSL) {
        this.settings.dealCloseConditionSL = closeConditionSl
      }
    }
    if (changeSl) {
      this.settings.slPerc = sl
    }
    return slOrders
  }
}

export default DCABotFunctions
