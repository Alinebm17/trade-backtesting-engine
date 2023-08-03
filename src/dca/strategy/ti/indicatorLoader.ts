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
} from '../../../../indicators/src'
import { MAEnum, IndicatorsEnum } from '../../../types'

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

  private data: IndicatorHistory[] = []

  private readonly type: IndicatorsEnum

  private readonly indicatorName: string

  constructor(indicatorConfig: IndicatorConfigBackTesting) {
    this.indicatorName =
      indicatorConfig.type === IndicatorsEnum.ma
        ? indicatorConfig.maType ?? indicatorConfig.type
        : indicatorConfig.type
    if (indicatorConfig.type === IndicatorsEnum.psar) {
      this.indicator = new FasterPSAR(
        indicatorConfig.start,
        indicatorConfig.inc,
        indicatorConfig.max,
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.rsi) {
      this.indicator = new FasterRSI(indicatorConfig.interval)
    }
    if (indicatorConfig.type === IndicatorsEnum.mfi) {
      this.indicator = new FasterMFI(indicatorConfig.interval)
    }
    if (indicatorConfig.type === IndicatorsEnum.adx) {
      this.indicator = new FasterADX(indicatorConfig.interval)
    }
    if (indicatorConfig.type === IndicatorsEnum.bbw) {
      const bb = new FasterBollingerBands(
        indicatorConfig.interval,
        indicatorConfig.deviationMultiplier,
      )
      this.indicator = new FasterBollingerBandsWidth(bb)
    }
    if (indicatorConfig.type === IndicatorsEnum.bb) {
      this.indicator = new FasterBollingerBands(indicatorConfig.interval, 2)
    }
    if (indicatorConfig.type === IndicatorsEnum.macd) {
      this.indicator = new FasterMACD(
        new FasterEMA(indicatorConfig.shortInterval),
        new FasterEMA(indicatorConfig.longInterval),
        new FasterEMA(indicatorConfig.signalInterval),
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.ma) {
      if (indicatorConfig.maType === MAEnum.ema) {
        this.indicator = new FasterEMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.sma) {
        this.indicator = new FasterSMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.wma) {
        this.indicator = new FasterWMATV(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.hma) {
        this.indicator = new FasterHMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.vwma) {
        this.indicator = new FasterVWMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.dema) {
        this.indicator = new FasterDEMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.tema) {
        this.indicator = new FasterTEMA(indicatorConfig.interval)
      }
      if (indicatorConfig.maType === MAEnum.rma) {
        this.indicator = new FasterRMA(indicatorConfig.interval)
      }
    }
    if (indicatorConfig.type === IndicatorsEnum.tv) {
      this.indicator = new FasterTVTA(
        indicatorConfig.checkLevel,
        indicatorConfig.useAsEntryExitPoints,
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.stoch) {
      this.indicator = new FasterStochasticOscillator(
        indicatorConfig.length,
        indicatorConfig.smoothK,
        indicatorConfig.smoothD,
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.stochRSI) {
      this.indicator = new FasterStochasticRSITV(
        indicatorConfig.rsiLength,
        indicatorConfig.length,
        indicatorConfig.smoothK,
        indicatorConfig.smoothD,
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.qfl) {
      this.indicator = new QFL(
        indicatorConfig.basePeriods,
        indicatorConfig.pumpPeriods,
        indicatorConfig.pump,
        indicatorConfig.baseCrack,
      )
    }
    if (indicatorConfig.type === IndicatorsEnum.sr) {
      this.indicator = new SupportResistance(
        indicatorConfig.leftBars,
        indicatorConfig.rightBars,
      )
    }
    this.type = indicatorConfig.type
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
            this.type === IndicatorsEnum.psar
              ? {
                  psar: result as unknown as number,
                  price: value.c,
                }
              : this.type !== IndicatorsEnum.ma
              ? this.type !== IndicatorsEnum.bb
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
