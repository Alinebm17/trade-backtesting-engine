import {
  OrderSizeTypeEnum,
  TerminalDealTypeEnum,
  CloseConditionEnum,
  GridBreakpoint,
  Asset,
  DCAGrid,
  StrategyEnum,
  BotOrderSideEnum,
  DCAOrderTypeEnum,
  FuturesStrategyEnum,
  BotMarginTypeEnum,
  Sizes,
  DynamicArPrices,
} from '../types'
import DcaBotFunctions from './dcaBotFunctions'

class ComboBotFunctions extends DcaBotFunctions {
  override createOrders(
    inputLatestPrice: number,
    all = false,
    precOrderSize = 0,
    breakpoints: GridBreakpoint[] = [],
    balances: Asset[] | null = [],
    outsideSl = false,
    _tpSlTargetFilled: string[] = [],
    updatedComboAdjustments = true,
    _fixSl = 0,
    _fixTp = 0,
    _fixSize = 0,
    _dcaArValues: DynamicArPrices[] = [],
    sizes?: Sizes,
  ): DCAGrid[] {
    const { settings, symbol } = this
    const baseOrderSize =
      parseFloat(settings.baseOrderSize) || parseFloat(settings.orderSize)
    const orderSize = parseFloat(settings.orderSize)
    const precision = this.utils.getBaseAssetPrecision(symbol)
    const quotePrecision = symbol ? symbol.priceAssetPrecision : 8
    const step = parseFloat(settings.step) / 100
    const baseStep = parseFloat(settings.baseStep ?? settings.step) / 100
    const stepScale = parseFloat(settings.stepScale)
    const volumeScale = parseFloat(settings.volumeScale)
    const feeFactor = 1 + this.userFee
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
      comboActiveMinigrids,
      useActiveMinigrids,
    } = settings
    const useTp = _useTp && dealCloseCondition === CloseConditionEnum.tp
    const useSl = _useSl && dealCloseConditionSL === CloseConditionEnum.tp
    const latestPrice = this.math.round(
      inputLatestPrice,
      symbol.priceAssetPrecision,
    )
    if (
      settings.useStaticPriceFilter &&
      ((minOpenDeal !== 0 && latestPrice <= minOpenDeal) ||
        (maxOpenDeal !== 0 && latestPrice >= maxOpenDeal))
    ) {
      return []
    }
    const feeOrder = settings.futures
      ? undefined
      : typeof settings.feeOrder !== 'undefined' && settings.feeOrder
      ? false
      : undefined
    let baseQty =
      orderSizeType === OrderSizeTypeEnum.base
        ? this.math.round(baseOrderSize + (sizes?.base ?? 0), precision, true)
        : orderSizeType === OrderSizeTypeEnum.quote
        ? this.math.round(
            (baseOrderSize * (coinm ? symbol.quoteAsset.minAmount : 1)) /
              latestPrice +
              (sizes?.base ?? 0),
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
      if (settings.futures) {
        qtyToUse *=
          settings.marginType !== BotMarginTypeEnum.inherit
            ? settings.leverage ?? 1
            : 1
      }
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
    const baseOrder: DCAGrid = {
      qty: baseQty,
      price: latestPrice,
      type: DCAOrderTypeEnum.bo,
      side: ordersSide,
      id: this.utils.id(20),
      priceDeviation: '0%',
      avgPrice: latestPrice,
      requiredPrice: undefined,
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
    baseOrder.minigridBudget =
      +(coinm ? baseOrder.base : baseOrder.quote ?? '0') *
      (settings.futures ? 1 : !long ? 2 - feeFactor : 1)

    const gridSettings = {
      lowPrice: long ? `${baseOrder.price}` : `${baseOrder.price * (1 - step)}`,
      topPrice: long ? `${baseOrder.price * (1 + step)}` : `${baseOrder.price}`,
      budget: `${baseOrder.minigridBudget}`,
      levels: settings.gridLevel ?? '1',
      useStartPrice: false,
      startPrice: undefined,
      updatedBudget: true,
      forceLocal: false,
      symbol,
      _lastPrice: baseOrder.price,
      userFee: this.userFee,
      sellDisplacement: `${this.userFee * 2 * 100}`,
      gridType: 'arithmetic' as const,
      initialPrice: baseOrder.price,
      futures: !!settings.futures,
      coinm: !!settings.coinm,
      profitCurrency: settings.futures
        ? 'quote'
        : settings.profitCurrency /*  'quote' as const */,
      orderFixedIn: settings.futures
        ? settings.coinm
          ? ('quote' as const)
          : ('base' as const)
        : settings.profitCurrency === 'quote'
        ? ('base' as const)
        : ('quote' as const),
      futuresStrategy: long
        ? FuturesStrategyEnum.long
        : FuturesStrategyEnum.short,
      useOrderInAdvance: false,
      combo: true,
      _side: BotOrderSideEnum.buy,
    }
    /* console.log('-----------------------')
    console.log(
      'base order before',
      baseOrder.qty,
      baseOrder.qty * baseOrder.price,
    )
    console.log('base order budget', gridSettings.budget) */
    const baseGridSettings = {
      ...gridSettings,
      lowPrice: long
        ? `${baseOrder.price}`
        : `${baseOrder.price * (1 - baseStep)}`,
      topPrice: long
        ? `${baseOrder.price * (1 + baseStep)}`
        : `${baseOrder.price}`,
      levels: `${+(settings.baseGridLevels ?? '1')}`,
    }
    let grids: DCAGrid[] = this.utils
      .createGridOrders(
        baseGridSettings,
        true,
        feeOrder,
        undefined,
        undefined,
        true,
      )
      .map((g) => ({
        ...g,
        type: DCAOrderTypeEnum.grid,
        relatedTo: baseOrder.id,
      }))
    const gridStep = latestPrice * step
    const useBase = long
    if (coinm) {
      const qtyByGrids = this.math.round(
        (grids.reduce(
          (acc, v) =>
            acc +
            Math.max(
              this.math.round(
                (v.qty * v.price) / symbol.quoteAsset.minAmount,
                0,
                true,
              ),
              0,
            ),
          0,
        ) *
          symbol.quoteAsset.minAmount) /
          latestPrice,
        precision,
      )
      /* console.log('base order used budget', qtyByGrids) */
      baseOrder.qty = qtyByGrids
      baseOrder.quote = this.math.round(
        baseOrder.qty * baseOrder.price,
        symbol.priceAssetPrecision,
      )
      baseOrder.base = baseOrder.qty
    } else {
      const qtyByGrids =
        useBase || settings.futures
          ? this.math.round(
              grids.reduce((acc, v) => acc + v.qty, 0) *
                (settings.futures ? 1 : feeFactor),
              precision,
              false,
              true,
            )
          : this.math.round(
              grids.reduce((acc, v) => acc + v.qty * v.price, 0),
              quotePrecision,
              false,
              true,
            )
      /*  console.log('base order used budget', qtyByGrids)
      console.log(
        'base order budget check condition',
        !long && qtyByGrids > baseOrder.quote * (2 - feeFactor),
      ) */
      if (
        (useBase && qtyByGrids > baseOrder.qty) ||
        (!useBase && qtyByGrids > baseOrder.quote * (2 - feeFactor)) ||
        settings.futures
      ) {
        grids =
          settings.futures || !useBase
            ? grids
            : this.utils
                .createGridOrders(
                  {
                    ...baseGridSettings,
                    budget: `${
                      coinm ? qtyByGrids : baseOrder.price * qtyByGrids
                    }`,
                  },
                  true,
                  feeOrder,
                  undefined,
                  undefined,
                  true,
                )
                .map((g) => ({ ...g, type: DCAOrderTypeEnum.grid }))
        baseOrder.qty =
          useBase || settings.futures
            ? updatedComboAdjustments
              ? this.math.round(qtyByGrids * feeFactor, precision, false, true)
              : qtyByGrids
            : this.math.round(
                (qtyByGrids / baseOrder.price) * feeFactor,
                precision,
                false,
                true,
              )
        baseOrder.quote =
          useBase || settings.futures
            ? this.math.round(
                baseOrder.qty * baseOrder.price,
                symbol.priceAssetPrecision,
              )
            : qtyByGrids * feeFactor
        baseOrder.base = baseOrder.qty
      }
    }
    let orders: DCAGrid[] = []
    /* console.log(
      'base order after',
      baseOrder.qty,
      baseOrder.qty * baseOrder.price,
    )
    console.log('-----------------------') */
    if (settings.useDca) {
      for (let i = 1; i <= parseInt(`${settings.ordersCount}`); i++) {
        const stepVal = stepScale ** (i - 1)
        const volumeVal = volumeScale ** (i - 1)
        let price = this.math.round(
          (i === 1 ? latestPrice : orders[orders.length - 1].price) -
            (settings.strategy === StrategyEnum.long ? 1 : -1) *
              gridStep *
              stepVal,
          symbol.priceAssetPrecision,
        )
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
        let qty =
          orderSizeType === OrderSizeTypeEnum.quote
            ? this.math.round(
                ((orderSize * (coinm ? symbol.quoteAsset.minAmount : 1)) /
                  price) *
                  volumeVal +
                  (sizes?.dca?.[i - 1] ?? 0),
                precision,
              )
            : orderSizeType === OrderSizeTypeEnum.base
            ? this.math.round(
                orderSize * volumeVal + (sizes?.dca?.[i - 1] ?? 0),
                precision,
              )
            : orderSizeType === OrderSizeTypeEnum.percFree ||
              orderSizeType === OrderSizeTypeEnum.percTotal
            ? precOrderSize !== 0
              ? this.math.round(precOrderSize * volumeVal, precision)
              : this.math.round(
                  ((qtyToUse * (+orderSize / 100)) /
                    (settings.futures
                      ? settings.coinm
                        ? 1
                        : price
                      : settings.terminalDealType ===
                        TerminalDealTypeEnum.import
                      ? settings.strategy === StrategyEnum.long
                        ? 1
                        : price
                      : settings.strategy === StrategyEnum.short
                      ? 1
                      : price)) *
                    volumeVal,
                  precision,
                )
            : this.math.round(
                Math.max(
                  symbol.quoteAsset.minAmount
                    ? symbol.quoteAsset.minAmount / price
                    : symbol.baseAsset.minAmount,
                  (qtyToUse * orderSize) / 100 / price,
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
        const modQty = this.math.remainder(qty, symbol.baseAsset.step)
        if (modQty !== 0) {
          qty = this.math.round(
            qty - modQty + symbol.baseAsset.step,
            precision,
            false,
            true,
          )
        }
        let base =
          baseOrder.qty + orders.reduce((acc, v) => acc + v.qty, 0) + qty
        let quote =
          baseOrder.price * baseOrder.qty +
          orders.reduce((acc, v) => acc + v.price * v.qty, 0) +
          qty * price
        const avgPrice = this.math.round(
          quote / base,
          symbol.priceAssetPrecision,
        )
        const id = this.utils.id(20)
        const minigridBudget =
          (coinm ? qty : qty * price) *
          (settings.futures ? 1 : !long ? 2 - feeFactor : 1)
        const isActiveMinigrid = !!(
          useActiveMinigrids &&
          typeof comboActiveMinigrids !== 'undefined' &&
          i <= +comboActiveMinigrids
        )
        let dcaMinigridOrders: DCAGrid[] = this.utils
          .createGridOrders(
            {
              ...gridSettings,
              lowPrice: long ? `${price}` : `${price - gridStep * stepVal}`,
              topPrice: long ? `${price + gridStep * stepVal}` : `${price}`,
              _lastPrice: isActiveMinigrid ? baseOrder.price : price,
              initialPrice: isActiveMinigrid ? baseOrder.price : price,
              budget: `${minigridBudget}`,
            },
            true,
            feeOrder,
            undefined,
            undefined,
            true,
          )
          .map((g) => ({
            ...g,
            type: DCAOrderTypeEnum.grid,
            grey: true,
            greyLabel: 'Grid',
            noLabel: true,
            relatedTo: id,
          }))
        if (settings.coinm) {
          const qtyByGrids = this.math.round(
            (dcaMinigridOrders.reduce(
              (acc, v) =>
                acc +
                Math.max(
                  this.math.round(
                    (v.qty * v.price) / symbol.quoteAsset.minAmount,
                    0,
                    true,
                  ),
                  0,
                ),
              0,
            ) *
              symbol.quoteAsset.minAmount) /
              price,
            precision,
            false,
            true,
          )
          qty = qtyByGrids
          quote =
            baseOrder.price * baseOrder.qty +
            orders.reduce((acc, v) => acc + v.price * v.qty, 0) +
            qty * price
          base = baseOrder.qty + orders.reduce((acc, v) => acc + v.qty, 0) + qty
        } else {
          const dcaQtyByGrids =
            useBase || settings.futures
              ? this.math.round(
                  dcaMinigridOrders.reduce((acc, v) => acc + v.qty, 0) *
                    (settings.futures ? 1 : feeFactor),
                  precision,
                  false,
                  true,
                )
              : this.math.round(
                  dcaMinigridOrders.reduce(
                    (acc, v) => acc + v.qty * v.price,
                    0,
                  ),
                  quotePrecision,
                  false,
                  true,
                )
          if (
            (useBase && dcaQtyByGrids > qty) ||
            (!useBase && dcaQtyByGrids > qty * price * (2 - feeFactor)) ||
            settings.futures
          ) {
            dcaMinigridOrders = (
              updatedComboAdjustments
                ? settings.futures || useBase
                : settings.futures || !useBase
            )
              ? dcaMinigridOrders
              : this.utils
                  .createGridOrders(
                    {
                      ...gridSettings,
                      lowPrice: long
                        ? `${price}`
                        : `${price - gridStep * stepVal}`,
                      topPrice: long
                        ? `${price + gridStep * stepVal}`
                        : `${price}`,
                      _lastPrice: isActiveMinigrid ? baseOrder.price : price,
                      initialPrice: isActiveMinigrid ? baseOrder.price : price,
                      budget: `${
                        coinm ? dcaQtyByGrids : dcaQtyByGrids * price
                      }`,
                    },
                    true,
                    feeOrder,
                    undefined,
                    undefined,
                    true,
                  )
                  .map((g) => ({
                    ...g,
                    type: DCAOrderTypeEnum.grid,
                    grey: !isActiveMinigrid,
                    greyLabel: 'Grid',
                    noLabel: !isActiveMinigrid,
                  }))
            qty =
              useBase || settings.futures
                ? dcaQtyByGrids
                : this.math.round(
                    (dcaQtyByGrids / price) *
                      (settings.futures ? 1 : feeFactor),
                    precision,
                    false,
                    true,
                  )
            quote =
              baseOrder.price * baseOrder.qty +
              orders.reduce((acc, v) => acc + v.price * v.qty, 0) +
              qty * price
            base =
              baseOrder.qty + orders.reduce((acc, v) => acc + v.qty, 0) + qty
          }
        }
        orders.push({
          qty,
          price,
          type: DCAOrderTypeEnum.dca,
          side: ordersSide,
          id,
          priceDeviation: `${this.math.round(
            ((latestPrice - price) / latestPrice) * 100,
            0,
          )}%`,
          avgPrice,
          requiredPrice: undefined,
          note:
            price < 0
              ? `This order won't be placed, because price deviation more than 100%`
              : qty * price < symbol.quoteAsset.minAmount
              ? `This order won't be placed, because order amount is less than min allowed by the exchange: ${symbol.quoteAsset.minAmount} ${symbol.quoteAsset.name}`
              : '',
          base: this.math.round(base, precision),
          quote: this.math.round(quote, symbol.priceAssetPrecision),
          levelNumber: i,
          minigridBudget,
          grey: isActiveMinigrid,
        })
        for (const o of dcaMinigridOrders) {
          grids.push(o)
        }
      }
      if (!all && useSmartOrders) {
        const start = useActiveMinigrids ? +(comboActiveMinigrids ?? '0') : 0
        orders = [
          ...orders
            .sort((a, b) =>
              settings.strategy === StrategyEnum.long
                ? b.price - a.price
                : a.price - b.price,
            )
            .slice(start, start + parseInt(`${activeOrdersCount}`)),
        ]
      }
    }
    const result = [...orders, baseOrder, ...grids]
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
}

export default ComboBotFunctions
