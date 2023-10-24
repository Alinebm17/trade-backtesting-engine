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

  private data: IndicatorHistory[] = []

  private readonly type: IndicatorEnum

  private readonly indicatorName: string

  public length = 0

  constructor(indicatorConfig: IndicatorConfigBackTesting) {
    this.indicatorName =
      indicatorConfig.type === IndicatorEnum.ma
        ? indicatorConfig.maType ?? indicatorConfig.type
        : indicatorConfig.type
    if (indicatorConfig.type === IndicatorEnum.psar) {
      this.indicator = new FasterPSAR(
        indicatorConfig.start,
        indicatorConfig.inc,
        indicatorConfig.max,
      )
      this.length = 100
    }
    if (indicatorConfig.type === IndicatorEnum.rsi) {
      this.indicator = new FasterRSI(indicatorConfig.interval)
      this.length = indicatorConfig.interval
    }
    if (indicatorConfig.type === IndicatorEnum.vo) {
      this.indicator = new FasterVO(
        indicatorConfig.voShort,
        indicatorConfig.voLong,
      )
      this.length = indicatorConfig.voLong
    }
    if (indicatorConfig.type === IndicatorEnum.mfi) {
      this.indicator = new FasterMFI(indicatorConfig.interval)
      this.length = indicatorConfig.interval
    }
    if (indicatorConfig.type === IndicatorEnum.adx) {
      this.indicator = new FasterADX(indicatorConfig.interval)
      this.length = indicatorConfig.interval
    }
    if (indicatorConfig.type === IndicatorEnum.bbw) {
      const bb = new FasterBollingerBands(
        indicatorConfig.interval,
        indicatorConfig.deviationMultiplier,
      )
      this.indicator = new FasterBollingerBandsWidth(bb)
      this.length = indicatorConfig.interval
    }
    if (indicatorConfig.type === IndicatorEnum.bb) {
      this.indicator = new FasterBollingerBands(indicatorConfig.interval, 2)
      this.length = indicatorConfig.interval
    }
    if (indicatorConfig.type === IndicatorEnum.macd) {
      this.indicator = new FasterMACD(
        new FasterEMA(indicatorConfig.shortInterval),
        new FasterEMA(indicatorConfig.longInterval),
        new FasterEMA(indicatorConfig.signalInterval),
      )
      this.length =
        Math.max(indicatorConfig.longInterval + indicatorConfig.shortInterval) +
        indicatorConfig.signalInterval
    }
    if (indicatorConfig.type === IndicatorEnum.ma) {
      if (indicatorConfig.maType === MAEnum.ema) {
        this.indicator = new FasterEMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.sma) {
        this.indicator = new FasterSMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.wma) {
        this.indicator = new FasterWMATV(indicatorConfig.interval)
        this.length = indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.hma) {
        this.indicator = new FasterHMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.vwma) {
        this.indicator = new FasterVWMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.dema) {
        this.indicator = new FasterDEMA(indicatorConfig.interval)
        this.length = 2 * indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.tema) {
        this.indicator = new FasterTEMA(indicatorConfig.interval)
        this.length = 3 * indicatorConfig.interval
      }
      if (indicatorConfig.maType === MAEnum.rma) {
        this.indicator = new FasterRMA(indicatorConfig.interval)
        this.length = indicatorConfig.interval + 1
      }
    }
    if (indicatorConfig.type === IndicatorEnum.tv) {
      this.indicator = new FasterTVTA(
        indicatorConfig.checkLevel,
        indicatorConfig.useAsEntryExitPoints,
      )
      this.length = 200
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
        indicatorConfig.smoothD
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
        indicatorConfig.smoothD
    }
    if (indicatorConfig.type === IndicatorEnum.qfl) {
      this.indicator = new QFL(
        indicatorConfig.basePeriods,
        indicatorConfig.pumpPeriods,
        indicatorConfig.pump,
        indicatorConfig.baseCrack,
      )
      this.length = indicatorConfig.basePeriods + indicatorConfig.pumpPeriods
    }
    if (indicatorConfig.type === IndicatorEnum.sr) {
      this.indicator = new SupportResistance(
        indicatorConfig.leftBars,
        indicatorConfig.rightBars,
      )
      this.length = indicatorConfig.leftBars + indicatorConfig.rightBars
    }
    this.type = indicatorConfig.type
    this.length = Math.max(Math.ceil(this.length * 3), 1000)
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
        this.indicator instanceof FasterBollingerBandsWidth ||
        this.indicator instanceof FasterBollingerBands ||
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
        this.indicator instanceof SupportResistance ||
        this.indicator instanceof QFL ||
        this.indicator instanceof FasterPSAR)
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
        this.indicator instanceof FasterTVTA)
    ) {
      this.indicator?.update({
        high: +value.h,
        low: +value.l,
        close: +value.c,
        open: +value.o,
        volume: +value.v,
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
