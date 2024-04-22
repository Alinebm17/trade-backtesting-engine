import {
  FasterRSI,
  FasterMFI,
  FasterADX,
  FasterBollingerBandsWidth,
  FasterBollingerBands,
  FasterMACD,
  FasterEMA,
  FasterVWMA,
  FasterHMA,
  FasterSMA,
  FasterTVTA,
  FasterWMATV,
  FasterDEMA,
  FasterTEMA,
  FasterRMA,
  FasterStochasticOscillator,
  FasterStochasticRSITV,
  SupportResistance,
  QFL,
  FasterPSAR,
  FasterVO,
  FasterCCI,
  FasterAO,
  FasterWilliamsR,
  FasterUltimateOscillator,
  FasterMOM,
  FasterBBWP,
  FasterECD,
  FasterMAR,
  FasterBBPB,
  FasterDIV,
  DIVUsableOscillators,
  SuperTrend,
  FasterPC,
  FasterATRTV,
} from '../../../../indicators/src'
import { MAEnum, IndicatorEnum } from '../../../types'

import type {
  IndicatorHistory,
  IndicatorConfigBackTesting,
} from '../../../types'

export default class InternalIndicator {
  private readonly indicator?:
    | FasterRSI
    | FasterMFI
    | FasterADX
    | FasterBollingerBandsWidth
    | FasterBollingerBands
    | FasterMACD
    | FasterEMA
    | FasterVWMA
    | FasterHMA
    | FasterSMA
    | FasterTVTA
    | FasterWMATV
    | FasterDEMA
    | FasterTEMA
    | FasterRMA
    | FasterStochasticOscillator
    | FasterStochasticRSITV
    | SupportResistance
    | QFL
    | FasterPSAR
    | FasterVO
    | FasterCCI
    | FasterAO
    | FasterWilliamsR
    | FasterUltimateOscillator
    | FasterMOM
    | FasterBBWP
    | FasterECD
    | FasterMAR
    | FasterBBPB
    | FasterDIV
    | SuperTrend
    | FasterPC
    | FasterATRTV
  private data: IndicatorHistory[] = []

  private readonly type: IndicatorEnum

  private readonly indicatorName: string

  public length = 0

  constructor(indicatorConfig: IndicatorConfigBackTesting) {
    this.indicatorName =
      indicatorConfig.type === IndicatorEnum.ma
        ? indicatorConfig.maType ?? indicatorConfig.type
        : indicatorConfig.type
    const add = 4
    if (indicatorConfig.type === IndicatorEnum.psar) {
      this.indicator = new FasterPSAR(
        indicatorConfig.start,
        indicatorConfig.inc,
        indicatorConfig.max,
      )
      this.length = add
    }
    if (indicatorConfig.type === IndicatorEnum.st) {
      this.indicator = new SuperTrend(
        indicatorConfig.factor,
        indicatorConfig.atrPeriod,
      )
      this.length = indicatorConfig.atrPeriod + add
    }
    if (indicatorConfig.type === IndicatorEnum.pc) {
      this.indicator = new FasterPC(
        indicatorConfig.pcUp,
        indicatorConfig.pcDown,
      )
      this.length = 2 + add
    }
    if (indicatorConfig.type === IndicatorEnum.rsi) {
      this.indicator = new FasterRSI(
        indicatorConfig.interval,
        undefined,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.atr) {
      this.indicator = new FasterATRTV(indicatorConfig.interval)
      this.length = indicatorConfig.interval + add
    }
    if (indicatorConfig.type === IndicatorEnum.mar) {
      this.indicator = new FasterMAR(
        indicatorConfig.mar1type,
        indicatorConfig.mar1length,
        indicatorConfig.mar2type,
        indicatorConfig.mar2length,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
        indicatorConfig.trendFilter,
        indicatorConfig.trendFilterLookback,
        indicatorConfig.trendFilterValue,
        indicatorConfig.trendFilterType,
      )
      this.length =
        Math.max(indicatorConfig.mar1length, indicatorConfig.mar2length) +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        (indicatorConfig.trendFilter
          ? indicatorConfig.trendFilterLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.ecd) {
      this.indicator = new FasterECD()
      this.length = 2 + add
    }
    if (indicatorConfig.type === IndicatorEnum.cci) {
      this.indicator = new FasterCCI(
        indicatorConfig.interval,
        'hlc3',
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.div) {
      this.length =
        34 +
        (indicatorConfig.leftBars ?? 3) +
        (indicatorConfig.rightBars ?? 1) +
        add
      this.indicator = new FasterDIV(
        indicatorConfig.oscillators.map((v) =>
          v.toLowerCase(),
        ) as DIVUsableOscillators[],
        indicatorConfig.leftBars ?? 3,
        indicatorConfig.rightBars ?? 1,
        indicatorConfig.rangeLower ?? 1,
        indicatorConfig.rangeUpper ?? 60,
      )
    }
    if (indicatorConfig.type === IndicatorEnum.ao) {
      this.indicator = new FasterAO(
        5,
        34,
        undefined,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        34 +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.wr) {
      this.indicator = new FasterWilliamsR(
        indicatorConfig.interval,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.uo) {
      this.indicator = new FasterUltimateOscillator(
        indicatorConfig.fast,
        indicatorConfig.middle,
        indicatorConfig.slow,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        Math.max(
          indicatorConfig.fast,
          indicatorConfig.middle,
          indicatorConfig.slow,
        ) +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.mom) {
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
      this.indicator = new FasterMOM(
        indicatorConfig.interval,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        indicatorConfig.source,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
    }
    if (indicatorConfig.type === IndicatorEnum.vo) {
      this.indicator = new FasterVO(
        indicatorConfig.voShort,
        indicatorConfig.voLong,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        Math.max(indicatorConfig.voLong, indicatorConfig.voShort) +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.mfi) {
      this.indicator = new FasterMFI(
        indicatorConfig.interval,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.adx) {
      this.indicator = new FasterADX(
        indicatorConfig.interval,
        undefined,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval * 2 +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.bbw) {
      const bb = new FasterBollingerBands(
        indicatorConfig.interval,
        indicatorConfig.bbwMult ?? 2,
        indicatorConfig.bbwMa ?? MAEnum.sma,
        indicatorConfig.bbwMaLength ?? 20,
      )
      this.indicator = new FasterBollingerBandsWidth(
        bb,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.bbwMaLength ?? 20) *
          (indicatorConfig.bbwMa === MAEnum.tema
            ? 3
            : indicatorConfig.bbwMa === MAEnum.dema
            ? 2
            : 1) +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.bbpb) {
      const bb = new FasterBollingerBands(
        indicatorConfig.interval,
        indicatorConfig.bbwMult ?? 2,
        indicatorConfig.bbwMa ?? MAEnum.sma,
        indicatorConfig.bbwMaLength ?? 20,
      )
      this.indicator = new FasterBBPB(
        bb,
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.bbwMaLength ?? 20) *
          (indicatorConfig.bbwMa === MAEnum.tema
            ? 3
            : indicatorConfig.bbwMa === MAEnum.dema
            ? 2
            : 1) +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.bbwp) {
      const bb = new FasterBollingerBands(
        indicatorConfig.interval,
        1,
        MAEnum.sma,
        20,
      )
      this.indicator = new FasterBBWP(
        bb,
        indicatorConfig.lookback,
        indicatorConfig.source,
      )
      this.length = indicatorConfig.interval + indicatorConfig.lookback + add
    }
    if (indicatorConfig.type === IndicatorEnum.bb) {
      this.indicator = new FasterBollingerBands(
        indicatorConfig.interval,
        indicatorConfig.bbwMult ?? 2,
        indicatorConfig.bbwMa ?? MAEnum.sma,
        indicatorConfig.bbwMaLength ?? 20,
      )
      this.length =
        indicatorConfig.interval +
        (indicatorConfig.bbwMaLength ?? 20) *
          (indicatorConfig.bbwMa === MAEnum.tema
            ? 3
            : indicatorConfig.bbwMa === MAEnum.dema
            ? 2
            : 1) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.macd) {
      const maSource =
        indicatorConfig.maSource === MAEnum.sma ? FasterSMA : FasterEMA
      const maSignal =
        indicatorConfig.maSignal === MAEnum.sma ? FasterSMA : FasterEMA
      this.indicator = new FasterMACD(
        new maSource(indicatorConfig.shortInterval),
        new maSource(indicatorConfig.longInterval),
        new maSignal(indicatorConfig.signalInterval),
        indicatorConfig.percentile,
        indicatorConfig.percentileLookback,
        indicatorConfig.percentilePercentage,
      )
      this.length =
        Math.max(indicatorConfig.longInterval + indicatorConfig.shortInterval) +
        indicatorConfig.signalInterval +
        (indicatorConfig.percentile
          ? indicatorConfig.percentileLookback ?? 0
          : 0) +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.ma) {
      if (indicatorConfig.maType === MAEnum.ema) {
        this.indicator = new FasterEMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval + 300
      }
      if (indicatorConfig.maType === MAEnum.sma) {
        this.indicator = new FasterSMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval + add
      }
      if (indicatorConfig.maType === MAEnum.wma) {
        this.indicator = new FasterWMATV(indicatorConfig.interval)
        this.length = indicatorConfig.interval + add
      }
      if (indicatorConfig.maType === MAEnum.hma) {
        this.indicator = new FasterHMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval * 2 + add
      }
      if (indicatorConfig.maType === MAEnum.vwma) {
        this.indicator = new FasterVWMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval + add
      }
      if (indicatorConfig.maType === MAEnum.dema) {
        this.indicator = new FasterDEMA(indicatorConfig.interval)
        this.length = 2 * indicatorConfig.interval + add
      }
      if (indicatorConfig.maType === MAEnum.tema) {
        this.indicator = new FasterTEMA(indicatorConfig.interval)
        this.length = 3 * indicatorConfig.interval + add
      }
      if (indicatorConfig.maType === MAEnum.rma) {
        this.indicator = new FasterRMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval + add
      }
    }
    if (indicatorConfig.type === IndicatorEnum.tv) {
      this.indicator = new FasterTVTA(
        indicatorConfig.checkLevel,
        indicatorConfig.useAsEntryExitPoints,
      )
      this.length = 3000
    }
    if (indicatorConfig.type === IndicatorEnum.stoch) {
      this.indicator = new FasterStochasticOscillator(
        indicatorConfig.length,
        indicatorConfig.smoothK,
        indicatorConfig.smoothD,
      )
      this.length =
        indicatorConfig.length +
        indicatorConfig.smoothK +
        indicatorConfig.smoothD +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.stochRSI) {
      this.indicator = new FasterStochasticRSITV(
        indicatorConfig.rsiLength,
        indicatorConfig.length,
        indicatorConfig.smoothK,
        indicatorConfig.smoothD,
      )
      this.length =
        indicatorConfig.rsiLength +
        indicatorConfig.length +
        indicatorConfig.smoothK +
        indicatorConfig.smoothD +
        add
    }
    if (indicatorConfig.type === IndicatorEnum.qfl) {
      this.indicator = new QFL(
        indicatorConfig.basePeriods,
        indicatorConfig.pumpPeriods,
        indicatorConfig.pump,
        indicatorConfig.baseCrack,
      )
      this.length =
        indicatorConfig.basePeriods + indicatorConfig.pumpPeriods + add
    }
    if (indicatorConfig.type === IndicatorEnum.sr) {
      this.indicator = new SupportResistance(
        indicatorConfig.leftBars,
        indicatorConfig.rightBars,
      )
      this.length = indicatorConfig.leftBars + indicatorConfig.rightBars + add
    }
    this.type = indicatorConfig.type
    this.length = this.length * 2
  }

  public updateValue(
    value: {
      o: number | string
      h: number | string
      l: number | string
      c: number | string
      v: number | string
    },
    time: number,
    cb: (data: IndicatorHistory[]) => void,
  ) {
    if (this.indicator && this.indicator instanceof FasterVO) {
      this.indicator.update(+value.v)
    }
    if (
      this.indicator &&
      (this.indicator instanceof FasterRSI ||
        this.indicator instanceof FasterMACD ||
        this.indicator instanceof FasterEMA ||
        this.indicator instanceof FasterDEMA ||
        this.indicator instanceof FasterTEMA ||
        this.indicator instanceof FasterRMA ||
        this.indicator instanceof FasterSMA ||
        this.indicator instanceof FasterWMATV ||
        this.indicator instanceof FasterHMA)
    ) {
      this.indicator?.update(+value.c)
    }
    if (
      this.indicator &&
      (this.indicator instanceof FasterADX ||
        this.indicator instanceof FasterStochasticOscillator ||
        this.indicator instanceof FasterStochasticRSITV ||
        this.indicator instanceof FasterWilliamsR ||
        this.indicator instanceof FasterUltimateOscillator ||
        this.indicator instanceof SupportResistance ||
        this.indicator instanceof QFL ||
        this.indicator instanceof FasterCCI ||
        this.indicator instanceof FasterPSAR ||
        this.indicator instanceof SuperTrend ||
        this.indicator instanceof FasterATRTV)
    ) {
      this.indicator?.update({
        high: +value.h,
        low: +value.l,
        close: +value.c,
      })
    }
    if (
      this.indicator &&
      (this.indicator instanceof FasterVWMA ||
        this.indicator instanceof FasterMFI ||
        this.indicator instanceof FasterTVTA ||
        this.indicator instanceof FasterMAR ||
        this.indicator instanceof FasterBollingerBandsWidth ||
        this.indicator instanceof FasterBBWP ||
        this.indicator instanceof FasterBBPB ||
        this.indicator instanceof FasterBollingerBands ||
        this.indicator instanceof FasterDIV ||
        this.indicator instanceof FasterPC)
    ) {
      this.indicator?.update({
        high: +value.h,
        low: +value.l,
        close: +value.c,
        open: +value.o,
        volume: +value.v,
      })
    }
    if (
      this.indicator &&
      (this.indicator instanceof FasterMOM ||
        this.indicator instanceof FasterECD)
    ) {
      this.indicator?.update({
        high: +value.h,
        low: +value.l,
        close: +value.c,
        open: +value.o,
      })
    }
    if (this.indicator && this.indicator instanceof FasterAO) {
      this.indicator?.update({
        high: +value.h,
        low: +value.l,
      })
    }
    try {
      const result = this.indicator?.getResult()
      if (result !== undefined) {
        this.data.push({
          time,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          value:
            this.type === IndicatorEnum.psar
              ? {
                  psar: result as unknown as number,
                  price: value.c,
                }
              : this.type !== IndicatorEnum.ma
              ? this.type !== IndicatorEnum.bb
                ? result
                : {
                    result,
                    price: value.c,
                  }
              : {
                  ma: result as unknown as number,
                  price: value.c,
                  maType: this.indicatorName,
                },
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          type: this.type,
        })
        if (this.data.length > 3) {
          this.data.shift()
        }
        if (this.data.length === 3) {
          cb([...this.data])
        }
      }
    } catch {
      cb([])
    }
  }

  get currentData() {
    return this.data
  }
}
