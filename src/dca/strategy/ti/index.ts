import { Strategy, StrategyInterface } from '../main'
import InternalIndicator from './indicatorLoader'
import {
  IndicatorEnum,
  TradingviewAnalysisConditionEnum,
  MAEnum,
  TradingviewAnalysisSignalEnum,
  rsiValueEnum,
  rsiValue2Enum,
  IndicatorStartConditionEnum,
  ExchangeIntervals,
  timeIntervalMap,
  BBCrossingEnum,
  SRCrossingEnum,
  IndicatorAction,
  IndicatorSection,
  StochRangeEnum,
  DCAConditionEnum,
  StrategyEnum,
  BotOrderSideEnum,
  ECDTriggerEnum,
} from '../../../types'

import type {
  IndicatorHistory,
  IndicatorConfigBackTesting,
  MAResult,
  SettingsIndicators,
  TradeResponse,
  FullBar,
} from '../../../types'
import type { DataType, StrategyInput } from '../main'
import { PercentileResult } from 'indicators/src'

export type Indicator = {
  instance: InternalIndicator
  data: IndicatorHistory[]
  id: string
  settings: SettingsIndicators
  interval: ExchangeIntervals
  statuses: { status: boolean; statusSince: number; statusTo: number }[]
  status: boolean
  ignore: boolean
  symbol: string
}

class TIStrategy extends Strategy implements StrategyInterface {
  private lowestData: DataType[] = []
  private firstBar: Map<string, number> = new Map()
  private nextBarTime: Map<string, number> = new Map()
  constructor(input: StrategyInput) {
    input.settings.indicators = input.settings.indicators.filter(
      (i) => i.indicatorAction !== IndicatorAction.stopBot,
    )
    super(input)
    this.processBar = this.processBar.bind(this)
    const { indicators } = input.settings
    for (const s of input.symbols) {
      for (const i of indicators) {
        const {
          type,
          indicatorLength,
          checkLevel,
          condition,
          maType,
          maUUID,
          uuid,
          maCrossingValue,
          maCrossingInterval,
          maCrossingLength,
          indicatorInterval,
          stochRSI,
          stochSmoothD,
          stochSmoothK,
          leftBars,
          rightBars,
          basePeriods,
          pumpPeriods,
          pump,
          baseCrack,
          psarInc,
          psarMax,
          psarStart,
          voLong,
          voShort,
          uoFast,
          uoMiddle,
          uoSlow,
          momSource,
          bbwpLookback,
          xOscillator1,
          xOscillator2,
          xOscillator2Interval,
          xOscillator2length,
          xoUUID,
          percentile,
          percentileLookback,
          percentilePercentage,
          mar1type,
          mar1length,
          mar2type,
          mar2length,
        } = i
        const ind = new InternalIndicator(
          type === IndicatorEnum.macd
            ? {
                type,
                shortInterval: 12,
                longInterval: 26,
                signalInterval: indicatorLength,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.tv
            ? {
                type,
                checkLevel,
                useAsEntryExitPoints:
                  condition === TradingviewAnalysisConditionEnum.entry,
              }
            : type === IndicatorEnum.ma
            ? {
                type,
                interval: indicatorLength,
                maType: maType || MAEnum.ema,
              }
            : type === IndicatorEnum.xo
            ? {
                type: xOscillator1 || IndicatorEnum.rsi,
                interval: indicatorLength,
              }
            : type === IndicatorEnum.stoch
            ? {
                type,
                length: indicatorLength,
                smoothD: stochSmoothD ?? 1,
                smoothK: stochSmoothK ?? 3,
              }
            : type === IndicatorEnum.stochRSI
            ? {
                type,
                length: indicatorLength,
                smoothD: stochSmoothD ?? 3,
                smoothK: stochSmoothK ?? 3,
                rsiLength: stochRSI ?? 14,
              }
            : type === IndicatorEnum.uo
            ? {
                type,
                fast: uoFast ?? 7,
                middle: uoMiddle ?? 14,
                slow: uoSlow ?? 28,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.mom
            ? {
                type,
                interval: indicatorLength,
                source: momSource ?? 'close',
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.mar
            ? {
                type,
                mar1type: mar1type || MAEnum.ema,
                mar1length: mar1length || 20,
                mar2type: mar2type || MAEnum.price,
                mar2length: mar2length || 20,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.bbwp
            ? {
                type,
                interval: indicatorLength,
                source: momSource ?? 'close',
                lookback: bbwpLookback ?? 252,
              }
            : type === IndicatorEnum.sr
            ? {
                type,
                leftBars: leftBars ?? 15,
                rightBars: rightBars ?? 15,
              }
            : type === IndicatorEnum.mfi
            ? {
                type,
                interval: indicatorLength ?? 14,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.qfl
            ? {
                type,
                basePeriods: basePeriods ?? 36,
                pumpPeriods: pumpPeriods ?? 8,
                pump: (pump ?? 3) / 100,
                baseCrack: (baseCrack ?? 3) / 100,
              }
            : type === IndicatorEnum.psar
            ? {
                type,
                max: psarMax ?? 0.2,
                inc: psarInc ?? 0.02,
                start: psarStart ?? 0.02,
              }
            : type === IndicatorEnum.vo
            ? {
                type,
                voLong: voLong ?? 10,
                voShort: voShort ?? 5,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.ecd
            ? { type }
            : ({
                type,
                interval: indicatorLength,
                percentile,
                percentileLookback,
                percentilePercentage,
              } as IndicatorConfigBackTesting),
        )
        Strategy.indicators.push({
          instance: ind,
          data: [],
          id: `${uuid}@${s.pair}`,
          settings: i,
          interval: indicatorInterval,
          statuses: [],
          status: false,
          ignore: false,
          symbol: s.pair,
        })
        if (
          type === IndicatorEnum.ma &&
          maCrossingValue !== MAEnum.price &&
          maCrossingInterval &&
          maCrossingLength &&
          maUUID &&
          maCrossingValue
        ) {
          const indicatorChild = new InternalIndicator({
            type,
            maType: maCrossingValue,
            interval: maCrossingLength,
          })
          Strategy.indicators.push({
            instance: indicatorChild,
            data: [],
            id: `${maUUID}@${s.pair}`,
            settings: i,
            interval: maCrossingInterval,
            statuses: [],
            status: false,
            ignore: true,
            symbol: s.pair,
          })
        }
        if (
          type === IndicatorEnum.xo &&
          xOscillator2 &&
          xOscillator2Interval &&
          xOscillator2length
        ) {
          const indicatorChild = new InternalIndicator({
            type: xOscillator2 || IndicatorEnum.mfi,
            interval: xOscillator2length || indicatorLength,
          })
          Strategy.indicators.push({
            instance: indicatorChild,
            data: [],
            id: `${xoUUID}@${s.pair}`,
            settings: i,
            interval: xOscillator2Interval || indicatorInterval,
            statuses: [],
            status: false,
            ignore: true,
            symbol: s.pair,
          })
        }
      }
    }
    this.updateIndicatorData = this.updateIndicatorData.bind(this)
    this.checkIndicators = this.checkIndicators.bind(this)
    Strategy.lowestInterval = Strategy.interval
  }

  public override getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    const intervals = Strategy.indicators.flatMap((i) => {
      const int = [
        {
          interval: i.settings.indicatorInterval,
          countBack: i.instance.length,
        },
      ]
      if (
        i.settings.type === IndicatorEnum.ma &&
        i.settings.maCrossingValue !== MAEnum.price &&
        i.settings.maCrossingInterval
      ) {
        int.push({
          interval: i.settings.maCrossingInterval,
          countBack: i.instance.length,
        })
      }
      if (
        i.settings.type === IndicatorEnum.xo &&
        i.settings.xOscillator2Interval &&
        i.settings.indicatorInterval !== i.settings.xOscillator2Interval
      ) {
        int.push({
          interval: i.settings.xOscillator2Interval,
          countBack: i.instance.length,
        })
      }
      return int
    })

    if (
      Strategy.lowestInterval &&
      !intervals.map((i) => i.interval).includes(Strategy.lowestInterval)
    ) {
      intervals.push({ interval: Strategy.lowestInterval, countBack: 0 })
    }
    return intervals
  }

  public async test(): Promise<void> {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    for (const b of lowest.bar) {
      await this.processBar(b)
    }
  }

  public async preTest(): Promise<void> {
    if (this.lowestData.length === 0) {
      this.lowestData = [...Strategy.data].sort(
        (a, b) => timeIntervalMap[b.interval] - timeIntervalMap[a.interval],
      )
    }
  }

  private checkStatuses(time: number) {
    Strategy.indicators = Strategy.indicators.map((i) => {
      const findStatus = i.statuses.find(
        (s) => time >= s.statusSince && time < s.statusTo,
      )
      if (findStatus) {
        i.statuses = i.statuses.filter(
          (s) =>
            s.statusSince !== findStatus.statusSince &&
            s.statusTo !== findStatus.statusTo,
        )
        i.status = findStatus.status
      }

      return i
    })
  }

  public processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar | null; interval: ExchangeIntervals }[],
  ): void {
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && trade.timestamp >= Strategy.start) || !Strategy.start)
    ) {
      this.startWorkingShift(trade.timestamp)
    }
    this.checkStatuses(trade.timestamp)
    this.checkInRange(+trade.price, trade.timestamp)
    if (candles.length) {
      for (const c of candles) {
        if (!c.candle) {
          return
        }
        const indicator = Strategy.indicators.find(
          (i) => i.interval === c.interval,
        )
        if (indicator) {
          indicator.instance.updateValue(
            {
              o: c.candle.open,
              h: c.candle.high,
              l: c.candle.low,
              c: c.candle.close,
              v: c.candle.volume ?? 0,
            },
            c.candle.time,
            this.updateIndicatorData(indicator),
          )
        }
        this.checkIndicators(c.candle)
      }
    }
    this.checkDeals({
      open: +trade.price,
      high: +trade.price,
      low: +trade.price,
      close: +trade.price,
      time: trade.timestamp,
      symbol: trade.symbol,
    })
  }

  public async processBar(bar: FullBar): Promise<void> {
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start)
    ) {
      this.startWorkingShift(bar.time)
    }
    this.checkStatuses(bar.time)
    this.checkInRange(bar.close, bar.time)
    const lowestIndicators = Strategy.indicators.filter(
      (i) => i.interval === Strategy.lowestInterval && i.symbol === bar.symbol,
    )
    const restIndicators = Strategy.indicators.filter(
      (i) => i.interval !== Strategy.lowestInterval && i.symbol === bar.symbol,
    )
    for (const i of lowestIndicators) {
      i.instance.updateValue(
        {
          o: bar.open,
          h: bar.high,
          l: bar.low,
          c: bar.close,
          v: bar.volume ?? 0,
        },
        bar.time,
        this.updateIndicatorData(i),
      )
    }
    const range = [
      bar.time + 1,
      bar.time + timeIntervalMap[Strategy.lowestInterval ?? Strategy.interval],
    ]
    /*  if (restIndicators.length === 0) {
      this.checkDeals(bar)
    } */
    for (const i of restIndicators) {
      const nextBarTime = this.nextBarTime.get(i.id)
      if (
        nextBarTime &&
        !(nextBarTime >= range[0] && nextBarTime <= range[1])
      ) {
        continue
      }
      const [data] = Strategy.data.filter((d) => d.interval === i.interval)
      if (data) {
        let bars: FullBar[] = []
        if ((this.firstBar.get(bar.symbol) ?? 0) < restIndicators.length) {
          this.firstBar.set(
            bar.symbol,
            (this.firstBar.get(bar.symbol) ?? 0) + 1,
          )
          bars = data.bar.filter(
            (b) => b.time < range[0] && b.symbol === bar.symbol,
          )
        }

        bars = bars.concat(
          data.bar.filter(
            (b) =>
              b.time >= range[0] &&
              b.time <= range[1] &&
              b.symbol === bar.symbol,
          ),
        )
        for (const b of bars) {
          i.instance.updateValue(
            {
              o: b.open,
              h: b.high,
              l: b.low,
              c: b.close,
              v: b.volume ?? 0,
            },
            b.time,
            this.updateIndicatorData(i),
          )
          this.nextBarTime.set(i.id, b.time + timeIntervalMap[i.interval])
          //this.checkDeals(b)
        }
      }
    }
    const isProcess = bar.time >= Strategy.start
    if (!isProcess) {
      return
    }

    this.checkIndicators(bar)

    await this.checkDeals(bar)
  }

  private updateIndicatorData(i: Indicator) {
    return (d: IndicatorHistory[]) => {
      i.data = d
      Strategy.indicators = [
        ...Strategy.indicators.filter((ii) => ii.id !== i.id),
        i,
      ]
    }
  }

  private checkIndicators(nextBar: FullBar) {
    const startIndicators = Strategy.indicators.filter(
      (si) => si.settings.indicatorAction === IndicatorAction.startDeal,
    )
    const closeIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.closeDeal,
    )
    const dcaIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.startDca,
    )
    if (
      (startIndicators.filter((i) => i.data.length > 0).length ||
        closeIndicators.filter((i) => i.data.length > 0).length ||
        dcaIndicators.filter((i) => i.data.length > 0).length) &&
      nextBar
    ) {
      const currentState = [...Strategy.indicators].filter(
        (i) =>
          i.id !== `${i.settings.maUUID}@${nextBar.symbol}` &&
          `${i.settings.xoUUID}@${nextBar.symbol}` &&
          i.data.length > 0 &&
          i.symbol === nextBar.symbol,
      )
      //Strategy.indicators = Strategy.indicators.map((i) => ({ ...i, data: [] }))
      for (const i of currentState) {
        let action = false
        const {
          settings: {
            indicatorValue,
            indicatorCondition,
            type,
            checkLevel,
            signal,
            maUUID,
            maCrossingValue,
            maType,
            bbCrossingValue,
            stochLower,
            stochUpper,
            rsiValue,
            rsiValue2,
            valueInsteadof,
            srCrossingValue,
            stochRange,
            keepConditionBars,
            ecdTrigger,
            xoUUID,
            xOscillator1,
            percentile,
          },
          data,
        } = i
        if (type === IndicatorEnum.qfl) {
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          action = lastData.value as boolean
        } else if (type === IndicatorEnum.tv && checkLevel && signal) {
          /**
           * TradingViews Technical Analysis
           *
           * Result:
           *  - 0 - neutral
           *
           *  - 1 - Buy
           *
           *  - 2 - Strong buy
           *
           *  - 3 - Sell
           *
           *  - 4 - Strong sell
           *
           *  - 5 - No action (for useEntryExitPoints)
           */
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          const tvta = lastData.value as number
          if (signal === TradingviewAnalysisSignalEnum.buy && tvta === 1) {
            action = true
          } else if (
            signal === TradingviewAnalysisSignalEnum.strongBuy &&
            tvta === 2
          ) {
            action = true
          } else if (
            signal === TradingviewAnalysisSignalEnum.bothBuy &&
            (tvta === 2 || tvta === 1)
          ) {
            action = true
          } else if (
            signal === TradingviewAnalysisSignalEnum.sell &&
            tvta === 3
          ) {
            action = true
          } else if (
            signal === TradingviewAnalysisSignalEnum.strongSell &&
            tvta === 4
          ) {
            action = true
          } else if (
            signal === TradingviewAnalysisSignalEnum.bothSell &&
            (tvta === 3 || tvta === 4)
          ) {
            action = true
          }
        } else if (type === IndicatorEnum.ecd && ecdTrigger) {
          /**
           * Engulfing candle detector
           *
           * Result:
           *  - 0 - na
           *
           *  - 1 - Bearish
           *
           *  - 2 - Bullish
           *
           */
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          const ecd = lastData.value as number
          if (
            ecd === 1 &&
            [ECDTriggerEnum.bearish, ECDTriggerEnum.both].includes(ecdTrigger)
          ) {
            action = true
          } else if (
            ecd === 2 &&
            [ECDTriggerEnum.bullish, ECDTriggerEnum.both].includes(ecdTrigger)
          ) {
            action = true
          }
        } else if (
          (indicatorValue !== undefined || type === IndicatorEnum.ma) &&
          indicatorCondition
        ) {
          let value = indicatorValue !== undefined ? +indicatorValue : 0
          let prevValue = value
          const [lastData, prevData] = [...data].sort((a, b) => b.time - a.time)
          let last = 0
          let prev = 0
          let checkValue = true
          if (
            (lastData.type === IndicatorEnum.rsi ||
              lastData.type === IndicatorEnum.ao ||
              lastData.type === IndicatorEnum.wr ||
              lastData.type === IndicatorEnum.cci ||
              lastData.type === IndicatorEnum.uo ||
              lastData.type === IndicatorEnum.mom ||
              lastData.type === IndicatorEnum.mfi ||
              lastData.type === IndicatorEnum.adx ||
              lastData.type === IndicatorEnum.bbw ||
              lastData.type === IndicatorEnum.vo ||
              lastData.type === IndicatorEnum.mar) &&
            (prevData.type === IndicatorEnum.rsi ||
              prevData.type === IndicatorEnum.ao ||
              prevData.type === IndicatorEnum.cci ||
              prevData.type === IndicatorEnum.uo ||
              prevData.type === IndicatorEnum.mom ||
              prevData.type === IndicatorEnum.wr ||
              prevData.type === IndicatorEnum.mfi ||
              prevData.type === IndicatorEnum.adx ||
              prevData.type === IndicatorEnum.bbw ||
              prevData.type === IndicatorEnum.vo ||
              prevData.type === IndicatorEnum.mar)
          ) {
            last = lastData.value.value
            prev = prevData.value.value
            if (percentile) {
              const tmpValue = lastData.value.percentile
              const tmpPrevValue = prevData.value.percentile
              if (
                typeof tmpValue === 'undefined' ||
                typeof tmpPrevValue === 'undefined'
              ) {
                last = 0
                prev = 0
                value = 0
                prevValue = 0
              } else {
                value = tmpValue
                prevValue = tmpPrevValue
              }
            }
          }
          if (
            lastData.type === IndicatorEnum.bbwp &&
            prevData.type === IndicatorEnum.bbwp
          ) {
            last = lastData.value
            prev = prevData.value
          }
          if (
            lastData.type === IndicatorEnum.macd &&
            prevData.type === IndicatorEnum.macd
          ) {
            last = lastData.value.histogram
            prev = prevData.value.histogram
          }
          if (
            lastData.type === IndicatorEnum.ma &&
            prevData.type === IndicatorEnum.ma
          ) {
            last = lastData.value.ma
            prev = prevData.value.ma
            if (maCrossingValue === MAEnum.price) {
              value = lastData.value.price
              prevValue = prevData.value.price
            } else if (lastData.value.maType === maType) {
              const findMA = Strategy.indicators.find(
                (ii) => ii.id === `${maUUID}@${nextBar.symbol}`,
              )
              if (findMA) {
                const [dataMA, prevMAData] = [
                  ...findMA.instance.currentData,
                ].sort((a, b) => b.time - a.time)
                prevValue = prevMAData ? (prevMAData.value as MAResult).ma : 0
                value = dataMA ? (dataMA.value as MAResult).ma : 0
                if (
                  (prevValue === 0 && value !== 0) ||
                  (value === 0 && prevValue !== 0)
                ) {
                  value = 0
                  prevValue = 0
                }
              }
            } else {
              value = 0
              prevValue = 0
              last = 0
              prev = 0
            }
          }
          if (
            IndicatorEnum.xo &&
            lastData.type === xOscillator1 &&
            prevData.type === xOscillator1
          ) {
            last = lastData.value.value
            prev = prevData.value.value

            const findXO = Strategy.indicators.find(
              (ii) => ii.id === `${xoUUID}@${nextBar.symbol}`,
            )
            if (findXO) {
              const [dataXO, prevXOData] = [
                ...findXO.instance.currentData,
              ].sort((a, b) => b.time - a.time)
              prevValue = prevXOData
                ? (prevXOData.value as PercentileResult).value
                : 0
              value = dataXO ? (dataXO.value as PercentileResult).value : 0
            } else {
              last = 0
              prev = 0
              value = 0
              prevValue = 0
            }
          }
          if (
            lastData.type === IndicatorEnum.psar &&
            prevData.type === IndicatorEnum.psar
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value = lastData.value.psar
            prevValue = prevData.value.psar
          }
          if (
            lastData.type === IndicatorEnum.bb &&
            prevData.type === IndicatorEnum.bb
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value =
              bbCrossingValue === BBCrossingEnum.lower
                ? lastData.value.result.lower
                : bbCrossingValue === BBCrossingEnum.middle
                ? lastData.value.result.middle
                : lastData.value.result.upper
            prevValue =
              bbCrossingValue === BBCrossingEnum.lower
                ? prevData.value.result.lower
                : bbCrossingValue === BBCrossingEnum.middle
                ? prevData.value.result.middle
                : prevData.value.result.upper
          }
          if (
            lastData.type === IndicatorEnum.sr &&
            prevData.type === IndicatorEnum.sr
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value =
              srCrossingValue === SRCrossingEnum.resistance
                ? lastData.value.high
                : lastData.value.low
            prevValue =
              srCrossingValue === SRCrossingEnum.resistance
                ? lastData.value.high
                : lastData.value.low
          }
          if (
            lastData.type === IndicatorEnum.bb &&
            prevData.type === IndicatorEnum.bb
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value =
              bbCrossingValue === BBCrossingEnum.lower
                ? lastData.value.result.lower
                : bbCrossingValue === BBCrossingEnum.middle
                ? lastData.value.result.middle
                : lastData.value.result.upper
            prevValue =
              bbCrossingValue === BBCrossingEnum.lower
                ? prevData.value.result.lower
                : bbCrossingValue === BBCrossingEnum.middle
                ? prevData.value.result.middle
                : prevData.value.result.upper
          }
          if (
            (lastData.type === IndicatorEnum.stoch &&
              prevData.type === IndicatorEnum.stoch) ||
            (lastData.type === IndicatorEnum.stochRSI &&
              prevData.type === IndicatorEnum.stochRSI)
          ) {
            if (rsiValue === rsiValueEnum.k) {
              last = lastData.value.stochK
              prev = prevData.value.stochK
            } else if (rsiValue === rsiValueEnum.d) {
              last = lastData.value.stochD
              prev = prevData.value.stochD
            }
            if (rsiValue2 === rsiValue2Enum.d) {
              value = lastData.value.stochD
              prevValue = prevData.value.stochD
            } else if (rsiValue2 === rsiValue2Enum.k) {
              value = lastData.value.stochK
              prevValue = prevData.value.stochK
            } else if (rsiValue2 === rsiValue2Enum.custom) {
              value = valueInsteadof ?? 1
              prevValue = valueInsteadof ?? 1
              checkValue = false
            }
          }
          if (
            (indicatorCondition === IndicatorStartConditionEnum.cu ||
              indicatorCondition === IndicatorStartConditionEnum.cd) &&
            data.length >= 2
          ) {
            if (indicatorCondition === IndicatorStartConditionEnum.cd) {
              action =
                this.math.gt(value, last) && this.math.lt(prevValue, prev)
            }
            if (indicatorCondition === IndicatorStartConditionEnum.cu) {
              action =
                this.math.lt(value, last) && this.math.gt(prevValue, prev)
            }
          }
          if (indicatorCondition === IndicatorStartConditionEnum.gt) {
            action = this.math.gt(last, value)
          }
          if (indicatorCondition === IndicatorStartConditionEnum.lt) {
            action = this.math.lt(last, value)
          }
          if (
            ((lastData.type === IndicatorEnum.stoch &&
              prevData.type === IndicatorEnum.stoch) ||
              (lastData.type === IndicatorEnum.stochRSI &&
                prevData.type === IndicatorEnum.stochRSI)) &&
            action &&
            checkValue &&
            stochRange !== StochRangeEnum.none
          ) {
            const upper =
              stochRange === StochRangeEnum.lower
                ? 100
                : stochRange === StochRangeEnum.upper
                ? +(stochLower ?? '')
                : +(stochUpper ?? '')
            const lower =
              stochRange === StochRangeEnum.upper
                ? 0
                : stochRange === StochRangeEnum.lower
                ? +(stochUpper ?? '')
                : +(stochLower ?? '')

            action =
              !isNaN(upper) &&
              !isNaN(lower) &&
              ((last > upper &&
                value > upper &&
                prev > upper &&
                prevValue > upper) ||
                (last < lower &&
                  value < lower &&
                  prev < lower &&
                  prevValue < lower))
          }
        }
        const [last] = [...data].sort((a, b) => b.time - a.time)
        const step = timeIntervalMap[i.interval]
        const toMultiplier = keepConditionBars
          ? isNaN(+keepConditionBars)
            ? 0
            : +keepConditionBars < 0
            ? 0
            : +keepConditionBars
          : 0

        const status = {
          status: action,
          statusSince: last.time + step,
          statusTo: last.time + step * 2 - 1,
        }

        i.statuses.push(status)
        if (toMultiplier > 0 && action) {
          let ind = 0
          for (const _v of [...Array(toMultiplier)]) {
            i.statuses.push({
              status: action,
              statusSince: last.time + step * (ind + 2),
              statusTo: last.time + step * (ind + 3) - 1,
            })
            ind++
          }
        }

        Strategy.indicators = [
          ...Strategy.indicators.filter((si) => si.id !== i.id),
          { ...i, data: [] },
        ]
      }
    }
    if (nextBar) {
      /* const data = this.lowestData
      const lowest = data[data.length - 1]
      const lowestBar = lowest?.bar?.find(
        (l) => l.time === nextBar.time && l.symbol === nextBar.symbol,
      ) */
      const closeDealSl = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.closeDeal &&
          i.settings.section === IndicatorSection.sl &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const closeDealTp = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.closeDeal &&
          i.settings.section !== IndicatorSection.sl &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const startDeal = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.startDeal &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const startDca = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.startDca &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const closeDealSlStatus = closeDealSl.filter((i) => i.status)
      const closeDealTpStatus = closeDealTp.filter((i) => i.status)
      const startDealStatus = startDeal.filter((i) => i.status)
      const startDcaStatus = startDca.filter((i) => i.status)
      if (
        closeDealSl.length === closeDealSlStatus.length &&
        closeDealSl.length
      ) {
        Strategy.indicatorEvents.push({
          type: IndicatorAction.closeDeal,
          side:
            this.settings.strategy === StrategyEnum.long
              ? BotOrderSideEnum.sell
              : BotOrderSideEnum.buy,
          time: nextBar.time,
          price:
            this.settings.strategy === StrategyEnum.long
              ? /* lowestBar?.high ?? */ nextBar.high
              : /* lowestBar?.low ?? */ nextBar.low,
          symbol: nextBar.symbol,
        })
        this.closeAllDeals(
          {
            open: /* lowestBar?.open ?? */ nextBar.open,
            time: nextBar.time,
            high: /* lowestBar?.open ?? */ nextBar.high,
            low: /* lowestBar?.low ?? */ nextBar.low,
            close: /* lowestBar?.close ?? */ nextBar.close,
            symbol: nextBar.symbol,
          },
          true,
        )

        Strategy.indicators = Strategy.indicators.map((i) => {
          if (closeDealSlStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
      }
      if (
        closeDealTp.length === closeDealTpStatus.length &&
        closeDealTp.length
      ) {
        Strategy.indicatorEvents.push({
          type: IndicatorAction.closeDeal,
          side:
            this.settings.strategy === StrategyEnum.long
              ? BotOrderSideEnum.sell
              : BotOrderSideEnum.buy,
          time: nextBar.time,
          price:
            this.settings.strategy === StrategyEnum.long
              ? /* lowestBar?.high ?? */ nextBar.high
              : /*  lowestBar?.low ?? */ nextBar.low,
          symbol: nextBar.symbol,
        })
        this.closeAllDeals({
          open: /* lowestBar?.open ?? */ nextBar.open,
          time: nextBar.time,
          high: /*  lowestBar?.open ??  */ nextBar.high,
          low: /*  lowestBar?.low ?? */ nextBar.low,
          close: /* lowestBar?.close ??  */ nextBar.close,
          symbol: nextBar.symbol,
        })

        Strategy.indicators = Strategy.indicators.map((i) => {
          if (closeDealTpStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
      }
      if (startDeal.length === startDealStatus.length && startDeal.length) {
        Strategy.indicatorEvents.push({
          type: IndicatorAction.startDeal,
          side:
            this.settings.strategy === StrategyEnum.long
              ? BotOrderSideEnum.buy
              : BotOrderSideEnum.sell,
          time: nextBar.time,
          price:
            this.settings.strategy === StrategyEnum.long
              ? /* lowestBar?.low ?? */ nextBar.low
              : /* lowestBar?.high ??  */ nextBar.high,
          symbol: nextBar.symbol,
        })
        this.openDeal(
          /* lowestBar?.open ??  */ nextBar.open,
          nextBar.time,
          /* lowestBar?.high ??  */ nextBar.high,
          /* lowestBar?.low ?? */ nextBar.low,
          nextBar.symbol,
        )

        Strategy.indicators = Strategy.indicators.map((i) => {
          if (startDealStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
      }
      if (
        startDcaStatus.length &&
        this.settings.dcaCondition === DCAConditionEnum.indicators
      ) {
        for (const i of startDcaStatus) {
          Strategy.indicators = Strategy.indicators.map((is) => {
            if (i.id === is.id) {
              return { ...is, status: false, statusSince: 0, statusTo: 0 }
            }
            return is
          })
          const index = startDca.findIndex((si) => si.id === i.id)
          this.addDCAOrder(
            index,
            /* lowestBar?.close ?? */ nextBar.close,
            nextBar.time,
            nextBar.symbol,
          )
        }
      }
    }
  }
}

export default TIStrategy
