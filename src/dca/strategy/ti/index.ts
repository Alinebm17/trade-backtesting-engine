import { Strategy, StrategyInterface } from '../main'
import InternalIndicator from './indicatorLoader'
import {
  IndicatorsEnum,
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
} from '../../../types'

import type {
  IndicatorHistory,
  IndicatorConfigBackTesting,
  MAResult,
  SettingsIndicators,
  TradeResponse,
} from '../../../types'
import type { StrategyInput, Bar } from '../main'

export type Indicator = {
  instance: InternalIndicator
  data: IndicatorHistory[]
  id: string
  settings: SettingsIndicators
  interval: ExchangeIntervals
  statuses: { status: boolean; statusSince: number; statusTo: number }[]
  status: boolean
}

class TIStrategy extends Strategy implements StrategyInterface {
  constructor(input: StrategyInput) {
    super(input)
    this.processBar = this.processBar.bind(this)
    const { indicators } = input.settings
    indicators.forEach((i) => {
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
      } = i
      const ind = new InternalIndicator(
        type === IndicatorsEnum.macd
          ? {
              type,
              shortInterval: 12,
              longInterval: 26,
              signalInterval: indicatorLength,
            }
          : type === IndicatorsEnum.tv
          ? {
              type,
              checkLevel,
              useAsEntryExitPoints:
                condition === TradingviewAnalysisConditionEnum.entry,
            }
          : type === IndicatorsEnum.ma
          ? {
              type,
              interval: indicatorLength,
              maType: maType || MAEnum.ema,
            }
          : type === IndicatorsEnum.stoch
          ? {
              type,
              length: indicatorLength,
              smoothD: stochSmoothD ?? 1,
              smoothK: stochSmoothK ?? 3,
            }
          : type === IndicatorsEnum.stochRSI
          ? {
              type,
              length: indicatorLength,
              smoothD: stochSmoothD ?? 3,
              smoothK: stochSmoothK ?? 3,
              rsiLength: stochRSI ?? 14,
            }
          : type === IndicatorsEnum.sr
          ? {
              type,
              leftBars: leftBars ?? 15,
              rightBars: rightBars ?? 15,
            }
          : type === IndicatorsEnum.mfi
          ? {
              type,
              interval: indicatorLength ?? 14,
            }
          : type === IndicatorsEnum.qfl
          ? {
              type,
              basePeriods: basePeriods ?? 36,
              pumpPeriods: pumpPeriods ?? 8,
              pump: (pump ?? 3) / 100,
              baseCrack: (baseCrack ?? 3) / 100,
            }
          : type === IndicatorsEnum.psar
          ? {
              type,
              max: psarMax ?? 0.2,
              inc: psarInc ?? 0.02,
              start: psarStart ?? 0.02,
            }
          : ({
              type,
              interval: indicatorLength,
            } as IndicatorConfigBackTesting),
      )
      Strategy.indicators.push({
        instance: ind,
        data: [],
        id: uuid,
        settings: i,
        interval: indicatorInterval,
        statuses: [],
        status: false,
      })
      if (
        type === IndicatorsEnum.ma &&
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
          id: maUUID,
          settings: i,
          interval: maCrossingInterval,
          statuses: [],
          status: false,
        })
      }
    })
    this.updateIndicatorData = this.updateIndicatorData.bind(this)
    this.checkIndicators = this.checkIndicators.bind(this)
    Strategy.lowestInterval = Strategy.interval
  }

  public override getOtherIntervals(): ExchangeIntervals[] {
    return Strategy.indicators
      .flatMap((i) => {
        const int = [i.settings.indicatorInterval]
        if (
          i.settings.type === IndicatorsEnum.ma &&
          i.settings.maCrossingValue !== MAEnum.price &&
          i.settings.maCrossingInterval
        ) {
          int.push(i.settings.maCrossingInterval)
        }
        return int
      })
      .filter((i) => i !== Strategy.interval)
  }

  public test(): void {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    lowest.bar.forEach((b) => this.processBar(b))
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
    candles: { candle: Bar | null; interval: ExchangeIntervals }[],
  ): void {
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(trade.timestamp)
    }
    this.checkStatuses(trade.timestamp)
    this.checkInRange(+trade.price, trade.timestamp)
    if (candles.length) {
      candles.forEach((c) => {
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
      })
    }
    this.checkDeals({
      open: +trade.price,
      high: +trade.price,
      low: +trade.price,
      close: +trade.price,
      time: trade.timestamp,
    })
  }

  public processBar(bar: Bar): void {
    if (Strategy.workingShift.length === 0) {
      this.startWorkingShift(bar.time)
    }
    this.checkStatuses(bar.time)
    this.checkInRange(bar.close, bar.time)
    const lowestIndicators = Strategy.indicators.filter(
      (i) => i.interval === Strategy.lowestInterval,
    )
    const restIndicators = Strategy.indicators.filter(
      (i) => i.interval !== Strategy.lowestInterval,
    )
    lowestIndicators.forEach((i) => {
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
    })
    const range = [
      bar.time + 1,
      bar.time + timeIntervalMap[Strategy.lowestInterval ?? Strategy.interval],
    ]
    /*  if (restIndicators.length === 0) {
      this.checkDeals(bar)
    } */
    restIndicators.forEach((i) => {
      const [data] = Strategy.data.filter((d) => d.interval === i.interval)
      if (data) {
        const bars = data.bar.filter(
          (b) => b.time >= range[0] && b.time <= range[1],
        )
        bars.forEach((b) => {
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
          //this.checkDeals(b)
        })
      }
    })

    this.checkIndicators(bar)
    this.checkDeals(bar)
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

  private checkIndicators(nextBar: Bar) {
    const startIndicators = Strategy.indicators.filter(
      (si) => si.settings.indicatorAction === IndicatorAction.startDeal,
    )
    const closeIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.closeDeal,
    )
    if (
      (startIndicators.filter((i) => i.data.length > 0).length ||
        closeIndicators.filter((i) => i.data.length > 0).length) &&
      nextBar
    ) {
      const currentState = [...Strategy.indicators].filter(
        (i) => i.id !== i.settings.maUUID && i.data.length > 0,
      )
      //Strategy.indicators = Strategy.indicators.map((i) => ({ ...i, data: [] }))
      currentState.forEach((i) => {
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
          },
          data,
        } = i
        if (type === IndicatorsEnum.qfl) {
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          action = lastData.value as boolean
        } else if (type === IndicatorsEnum.tv && checkLevel && signal) {
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
        } else if (
          (indicatorValue !== undefined || type === IndicatorsEnum.ma) &&
          indicatorCondition
        ) {
          let value = indicatorValue !== undefined ? +indicatorValue : 0
          let prevValue = value
          const [lastData, prevData] = [...data].sort((a, b) => b.time - a.time)
          let last = 0
          let prev = 0
          let checkValue = false
          if (
            (lastData.type === IndicatorsEnum.rsi ||
              lastData.type === IndicatorsEnum.mfi ||
              lastData.type === IndicatorsEnum.adx ||
              lastData.type === IndicatorsEnum.bbw) &&
            (prevData.type === IndicatorsEnum.rsi ||
              prevData.type === IndicatorsEnum.mfi ||
              prevData.type === IndicatorsEnum.adx ||
              prevData.type === IndicatorsEnum.bbw)
          ) {
            last = lastData.value
            prev = prevData.value
          }
          if (
            lastData.type === IndicatorsEnum.macd &&
            prevData.type === IndicatorsEnum.macd
          ) {
            last = lastData.value.histogram
            prev = prevData.value.histogram
          }
          if (
            lastData.type === IndicatorsEnum.ma &&
            prevData.type === IndicatorsEnum.ma
          ) {
            last = lastData.value.ma
            prev = prevData.value.ma
            if (maCrossingValue === MAEnum.price) {
              value = lastData.value.price
              prevValue = prevData.value.price
            } else if (lastData.value.maType === maType) {
              const findMA = Strategy.indicators.find((ii) => ii.id === maUUID)
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
            lastData.type === IndicatorsEnum.psar &&
            prevData.type === IndicatorsEnum.psar
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value = lastData.value.psar
            prevValue = prevData.value.psar
          }
          if (
            lastData.type === IndicatorsEnum.bb &&
            prevData.type === IndicatorsEnum.bb
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
            lastData.type === IndicatorsEnum.sr &&
            prevData.type === IndicatorsEnum.sr
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
            lastData.type === IndicatorsEnum.bb &&
            prevData.type === IndicatorsEnum.bb
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
            (lastData.type === IndicatorsEnum.stoch &&
              prevData.type === IndicatorsEnum.stoch) ||
            (lastData.type === IndicatorsEnum.stochRSI &&
              prevData.type === IndicatorsEnum.stochRSI)
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
              /* if (startNewDeal) {
                console.log(
                  `val - ${value}, last - ${last}, prevVal - ${prevValue}, prev - ${prev}`,
                )
              } */
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
            ((lastData.type === IndicatorsEnum.stoch &&
              prevData.type === IndicatorsEnum.stoch) ||
              (lastData.type === IndicatorsEnum.stochRSI &&
                prevData.type === IndicatorsEnum.stochRSI)) &&
            action &&
            checkValue
          ) {
            const upper = +(stochUpper ?? '')
            const lower = +(stochLower ?? '')
            action =
              (!isNaN(upper) &&
                !isNaN(lower) &&
                last > upper &&
                value > upper) ||
              (last < lower && value < lower)
          }
        }
        const [last] = [...data].sort((a, b) => b.time - a.time)
        const step = timeIntervalMap[i.interval]
        const status = {
          status: action,
          statusSince: last.time + step,
          statusTo: last.time + step * 2 - 1,
        }
        i.statuses.push(status)
        Strategy.indicators = [
          ...Strategy.indicators.filter((si) => si.id !== i.id),
          { ...i, data: [] },
        ]
      })
    }
    if (nextBar) {
      const data = [...Strategy.data].sort(
        (a, b) => timeIntervalMap[b.interval] - timeIntervalMap[a.interval],
      )
      const lowest = data[data.length - 1]
      const lowestBar = lowest.bar.find((l) => l.time === nextBar.time)
      const closeDealSl = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.closeDeal &&
          i.settings.section === IndicatorSection.sl,
      )
      const closeDealTp = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.closeDeal &&
          i.settings.section !== IndicatorSection.sl,
      )
      const startDeal = [...Strategy.indicators].filter(
        (i) => i.settings.indicatorAction === IndicatorAction.startDeal,
      )
      const closeDealSlStatus = closeDealSl.filter((i) => i.status)
      const closeDealTpStatus = closeDealTp.filter((i) => i.status)
      const startDealStatus = startDeal.filter((i) => i.status)

      if (
        closeDealSl.length === closeDealSlStatus.length &&
        closeDealSl.length
      ) {
        Strategy.indicators = Strategy.indicators.map((i) => {
          if (closeDealSlStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
        this.closeAllDeals({
          open: lowestBar?.open ?? nextBar.open,
          time: nextBar.time,
          high: lowestBar?.open ?? nextBar.high,
          low: lowestBar?.low ?? nextBar.low,
          close: lowestBar?.close ?? nextBar.close,
        })
      }
      if (
        closeDealTp.length === closeDealTpStatus.length &&
        closeDealTp.length
      ) {
        Strategy.indicators = Strategy.indicators.map((i) => {
          if (closeDealTpStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
        this.closeAllDeals({
          open: lowestBar?.open ?? nextBar.open,
          time: nextBar.time,
          high: lowestBar?.open ?? nextBar.high,
          low: lowestBar?.low ?? nextBar.low,
          close: lowestBar?.close ?? nextBar.close,
        })
      }
      if (startDeal.length === startDealStatus.length && startDeal.length) {
        Strategy.indicators = Strategy.indicators.map((i) => {
          if (startDealStatus.map((ai) => ai.id).includes(i.id)) {
            return { ...i, status: false, statusSince: 0, statusTo: 0 }
          }
          return i
        })
        this.openDeal(
          lowestBar?.open ?? nextBar.open,
          nextBar.time,
          lowestBar?.high ?? nextBar.high,
          lowestBar?.low ?? nextBar.low,
        )
      }
    }
  }
}

export default TIStrategy
