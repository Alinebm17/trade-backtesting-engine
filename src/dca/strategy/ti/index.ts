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
  DivTypeEnum,
  TrendFilterOperatorEnum,
  STConditionEnum,
  StartConditionEnum,
  CloseConditionEnum,
  BotStartTypeEnum,
  PCConditionEnum,
  ppValueEnum,
  ppValueTypeEnum,
  ScaleDcaTypeEnum,
  RangeType,
  IndicatorsLogicEnum,
  DCValueEnum,
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
import {
  DIVResult,
  PCResult,
  PercentileResult,
  PriorPivotResult,
  QFLResult,
  SuperTrendResult,
} from '../../../../indicators/src'

type Status = {
  status: boolean
  statusSince: number
  statusTo: number
  numberOfSignals?: number
}

export type Indicator = {
  instance: InternalIndicator
  data: IndicatorHistory[]
  id: string
  settings: SettingsIndicators
  interval: ExchangeIntervals
  statuses: Status[]
  status: Status
  ignore: boolean
  symbol: string
  groupId: string
}

class TIStrategy extends Strategy implements StrategyInterface {
  private lowestData: DataType[] = []
  private firstBar: Map<string, number> = new Map()
  private nextBarTime: Map<string, number> = new Map()
  private nextAction = false
  constructor(input: StrategyInput) {
    /* input.settings.indicators = input.settings.indicators.filter(
      (i) => i.indicatorAction !== IndicatorAction.stopBot,
    ) */
    super(input)
    this.processBar = this.processBar.bind(this)
    const { indicators } = input.settings
    for (const s of input.symbols) {
      for (const i of indicators.filter(
        (_i) => _i.type !== IndicatorEnum.unpnl,
      )) {
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
          bbwMa,
          bbwMaLength,
          bbwMult,
          macdFast,
          macdSlow,
          macdMaSignal,
          macdMaSource,
          divOscillators,
          trendFilter,
          trendFilterType,
          trendFilterLookback,
          trendFilterValue,
          factor,
          atrLength,
          indicatorAction,
          section,
          pcValue,
          ppHighLeft,
          ppHighRight,
          ppLowLeft,
          ppLowRight,
          ppMult,
          athLookback,
          kcMa,
          kcRange,
          kcRangeLength,
        } = i
        const scaleAr =
          (this.settings.dcaCondition === DCAConditionEnum.percentage ||
            !this.settings.dcaCondition) &&
          [ScaleDcaTypeEnum.adr, ScaleDcaTypeEnum.atr].includes(
            this.settings.scaleDcaType ?? ScaleDcaTypeEnum.percentage,
          ) &&
          this.settings.useDca &&
          indicatorAction === IndicatorAction.startDca
        const tpAr =
          indicatorAction === IndicatorAction.closeDeal &&
          section !== IndicatorSection.sl &&
          this.settings.dealCloseCondition === CloseConditionEnum.dynamicAr &&
          this.settings.useTp
        const slAr =
          indicatorAction === IndicatorAction.closeDeal &&
          section === IndicatorSection.sl &&
          this.settings.dealCloseConditionSL === CloseConditionEnum.dynamicAr &&
          this.settings.useSl
        if (
          (this.settings.startCondition !== StartConditionEnum.ti &&
            indicatorAction === IndicatorAction.startDeal) ||
          (!this.settings.useRiskReward &&
            indicatorAction === IndicatorAction.riskReward) ||
          ((!this.settings.useTp ||
            (this.settings.dealCloseCondition !== CloseConditionEnum.techInd &&
              this.settings.dealCloseCondition !==
                CloseConditionEnum.dynamicAr)) &&
            indicatorAction === IndicatorAction.closeDeal &&
            section !== IndicatorSection.sl) ||
          ((!this.settings.useSl ||
            (this.settings.dealCloseConditionSL !==
              CloseConditionEnum.techInd &&
              this.settings.dealCloseConditionSL !==
                CloseConditionEnum.dynamicAr)) &&
            indicatorAction === IndicatorAction.closeDeal &&
            section === IndicatorSection.sl) ||
          ((!this.settings.useDca ||
            !(
              this.settings.dcaCondition === DCAConditionEnum.indicators ||
              scaleAr
            )) &&
            indicatorAction === IndicatorAction.startDca) ||
          ((!this.settings.useBotController ||
            this.settings.botStart !== BotStartTypeEnum.indicators) &&
            indicatorAction === IndicatorAction.stopBot) ||
          ((!this.settings.useBotController ||
            this.settings.botActualStart !== BotStartTypeEnum.indicators) &&
            indicatorAction === IndicatorAction.startBot)
        ) {
          continue
        }
        const ind = new InternalIndicator(
          type === IndicatorEnum.dc
            ? { type, length: indicatorLength }
            : type === IndicatorEnum.macd
            ? {
                type,
                shortInterval: macdFast ?? 12,
                longInterval: macdSlow ?? 26,
                signalInterval: indicatorLength,
                percentile,
                percentileLookback,
                percentilePercentage,
                maSignal: macdMaSignal ?? MAEnum.ema,
                maSource: macdMaSource ?? MAEnum.ema,
              }
            : type === IndicatorEnum.tv
            ? {
                type,
                checkLevel,
                useAsEntryExitPoints:
                  condition === TradingviewAnalysisConditionEnum.entry,
              }
            : type === IndicatorEnum.pp
            ? {
                type,
                ppHighLeft: +(ppHighLeft ?? 5),
                ppHighRight: +(ppHighRight ?? 5),
                ppLowLeft: +(ppLowLeft ?? 5),
                ppLowRight: +(ppLowRight ?? 5),
                ppMult: +(ppMult ?? 1),
              }
            : type === IndicatorEnum.kc
            ? {
                type,
                interval: indicatorLength,
                ma: kcMa || MAEnum.ema,
                multiplier: bbwMult || 2,
                range: kcRange || RangeType.atr,
                rangeLength: kcRangeLength || 10,
              }
            : type === IndicatorEnum.kcpb
            ? {
                type,
                interval: indicatorLength,
                ma: kcMa || MAEnum.ema,
                multiplier: bbwMult || 2,
                range: kcRange || RangeType.atr,
                rangeLength: kcRangeLength || 10,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.pc
            ? {
                type,
                pcUp: Math.abs(+(pcValue ?? '5')),
                pcDown: Math.abs(+(pcValue ?? '5')),
              }
            : type === IndicatorEnum.st
            ? {
                type,
                factor: factor ?? 3,
                atrPeriod: atrLength ?? 10,
              }
            : type === IndicatorEnum.div
            ? {
                type,
                oscillators: divOscillators ?? [],
              }
            : type === IndicatorEnum.ma
            ? {
                type,
                interval: indicatorLength,
                maType: maType || MAEnum.ema,
              }
            : type === IndicatorEnum.bb
            ? {
                type,
                interval: indicatorLength,
                bbwMa: bbwMa || MAEnum.sma,
                bbwMaLength: bbwMaLength || 20,
                bbwMult: bbwMult || 2,
              }
            : type === IndicatorEnum.bbw
            ? {
                type,
                interval: indicatorLength,
                bbwMa: bbwMa || MAEnum.sma,
                bbwMaLength: bbwMaLength || 20,
                bbwMult: bbwMult || 2,
                percentile,
                percentileLookback,
                percentilePercentage,
              }
            : type === IndicatorEnum.ath
            ? {
                type,
                lookback: athLookback ?? 100,
              }
            : type === IndicatorEnum.bbpb
            ? {
                type,
                interval: indicatorLength,
                bbwMa: bbwMa || MAEnum.sma,
                bbwMaLength: bbwMaLength || 20,
                bbwMult: bbwMult || 2,
                percentile,
                percentileLookback,
                percentilePercentage,
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
                trendFilter,
                trendFilterLookback,
                trendFilterType,
                trendFilterValue,
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
            : type === IndicatorEnum.atr
            ? {
                type,
                interval: indicatorLength ?? 14,
              }
            : type === IndicatorEnum.adr
            ? {
                type,
                interval: indicatorLength ?? 14,
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
          interval:
            type === IndicatorEnum.adr
              ? ExchangeIntervals.oneD
              : indicatorInterval,
          statuses: [],
          status: { status: false, statusSince: 0, statusTo: 0 },
          ignore: false,
          symbol: s.pair,
          groupId: i.groupId,
        })
        if (
          type === IndicatorEnum.ma &&
          maCrossingValue !== MAEnum.price &&
          maCrossingInterval &&
          maCrossingLength &&
          maUUID &&
          maCrossingValue &&
          indicatorAction !== IndicatorAction.riskReward &&
          !scaleAr &&
          !tpAr &&
          !slAr
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
            status: { status: false, statusSince: 0, statusTo: 0 },
            ignore: true,
            symbol: s.pair,
            groupId: '',
          })
        }
        if (
          type === IndicatorEnum.xo &&
          xOscillator2 &&
          xOscillator2Interval &&
          xOscillator2length &&
          indicatorAction !== IndicatorAction.riskReward &&
          !scaleAr &&
          !tpAr &&
          !slAr
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
            status: { status: false, statusSince: 0, statusTo: 0 },
            ignore: true,
            symbol: s.pair,
            groupId: '',
          })
        }
      }
    }
    this.updateIndicatorData = this.updateIndicatorData.bind(this)
    this.checkIndicators = this.checkIndicators.bind(this)
    Strategy.lowestInterval = Strategy.interval
    Strategy.highestInterval = input.settings.indicators
      .filter((i) => i.indicatorAction === IndicatorAction.startDeal)
      .map((i) => i.indicatorInterval)
      .sort((a, b) => timeIntervalMap[b] - timeIntervalMap[a])?.[0]
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
      await this.processBar(false, b)
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
        i.status = findStatus
      } else {
        i.statuses = i.statuses.filter((s) => s.statusTo > time)
        if (i.status.statusTo < time) {
          i.status = {
            status: false,
            statusSince: 0,
            statusTo: 0,
          }
        }
      }

      return i
    })
  }

  public processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ): void {
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && trade.timestamp >= Strategy.start) || !Strategy.start)
    ) {
      this.startWorkingShift(trade.timestamp)
    }
    this.checkStatuses(trade.timestamp)
    this.checkInRange(trade.symbol, +trade.price, trade.timestamp)
    if (candles.length) {
      for (const c of candles) {
        if (!c.candle) {
          continue
        }

        const indicator = Strategy.indicators.find(
          (i) =>
            i.interval === c.interval && i.symbol === c.candle?.[0]?.symbol,
        )
        for (const _c of c.candle) {
          if (indicator) {
            indicator.instance.updateValue(
              {
                o: _c.open,
                h: _c.high,
                l: _c.low,
                c: _c.close,
                v: _c.volume ?? 0,
              },
              _c.time,
              this.updateIndicatorData(indicator),
            )
          }
          const isProcess = _c.time >= Strategy.start
          if (!isProcess) {
            continue
          }
          this.checkIndicators(_c)
        }
      }
    }
    this.checkDeals(false, {
      open: +trade.price,
      high: +trade.price,
      low: +trade.price,
      close: +trade.price,
      time: trade.timestamp,
      symbol: trade.symbol,
    })
  }

  public async processBar(
    checkPortfolio: boolean,
    bar: FullBar,
    interval?: ExchangeIntervals,
  ): Promise<void> {
    if (
      Strategy.workingShift.length === 0 &&
      ((Strategy.start && bar.time >= Strategy.start) || !Strategy.start)
    ) {
      this.startWorkingShift(bar.time)
    }
    this.checkStatuses(bar.time)
    this.checkInRange(bar.symbol, bar.close, bar.time)
    let hasLowest = false
    let hasRest = false
    if (Strategy.useFile && interval) {
      for (const i of Strategy.indicators.filter(
        (_i) => _i.interval === interval && _i.symbol === bar.symbol,
      )) {
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
    } else {
      const lowestIndicators = Strategy.indicators.filter(
        (i) =>
          i.interval === Strategy.lowestInterval && i.symbol === bar.symbol,
      )
      hasLowest = lowestIndicators.length > 0
      const restIndicators = Strategy.indicators.filter(
        (i) =>
          i.interval !== Strategy.lowestInterval && i.symbol === bar.symbol,
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
        bar.time +
          timeIntervalMap[Strategy.lowestInterval ?? Strategy.interval],
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
        const _data = Strategy.dataMap.get(i.interval)
        if (_data) {
          const data = Array.from(_data.values())
          let bars: FullBar[] = []
          if ((this.firstBar.get(bar.symbol) ?? 0) < restIndicators.length) {
            this.firstBar.set(
              bar.symbol,
              (this.firstBar.get(bar.symbol) ?? 0) + 1,
            )
            bars = data.filter(
              (b) => b.time < range[0] && b.symbol === bar.symbol,
            )
          }

          for (const d of data.filter(
            (b) =>
              b.time >= range[0] &&
              b.time <= range[1] &&
              b.symbol === bar.symbol,
          )) {
            bars.push(d)
          }

          hasRest = bars.length > 0

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
    }
    let isProcess = bar.time >= Strategy.start
    if (Strategy.useFile) {
      isProcess = isProcess && interval === Strategy.lowestInterval
    }
    if (!isProcess) {
      return
    }

    if (this.nextAction || Strategy.useFile) {
      this.checkIndicators(bar)
    }

    this.nextAction = hasLowest || hasRest

    await this.checkDeals(checkPortfolio, bar)
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
    const stopIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.stopBot,
    )
    const botStartIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.startBot,
    )
    const riskIndicators = Strategy.indicators.filter(
      (ci) => ci.settings.indicatorAction === IndicatorAction.riskReward,
    )
    if (
      this.settings.useRiskReward &&
      this.settings.startCondition === StartConditionEnum.asap &&
      !this.settings.useStaticPriceFilter &&
      !this.settings.useDynamicPriceFilter &&
      riskIndicators.filter((i) => i.data.length > 0).length
    ) {
      const dealsPerSymbols = Strategy.getDealsCount(undefined, nextBar.symbol)
      if (!dealsPerSymbols) {
        this.openDeal(
          nextBar.open,
          nextBar.time,
          nextBar.high,
          nextBar.low,
          nextBar.symbol,
        )
      }
    }
    if (
      (startIndicators.filter((i) => i.data.length > 0).length ||
        closeIndicators.filter((i) => i.data.length > 0).length ||
        (stopIndicators.filter((i) => i.data.length > 0).length &&
          Strategy.status === 'open' &&
          !Strategy.preventOpen) ||
        dcaIndicators.filter((i) => i.data.length > 0).length ||
        (botStartIndicators.filter((i) => i.data.length > 0).length &&
          Strategy.preventOpen &&
          Strategy.status === 'monitoring')) &&
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
        let skipAction = false
        let trendFilterAction = false
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
            divMinCount,
            divType,
            trendFilter,
            trendFilterType,
            stCondition,
            pcValue,
            ppValue,
            ppType,
            indicatorAction,
            section,
            dcValue,
          },
          data,
        } = i
        if (
          indicatorAction === IndicatorAction.riskReward &&
          Strategy.indicators.length > this.settings.pair.length
        ) {
          continue
        }
        if (
          indicatorAction === IndicatorAction.startDca &&
          (this.settings.dcaCondition === DCAConditionEnum.percentage ||
            !this.settings.dcaCondition) &&
          [ScaleDcaTypeEnum.adr, ScaleDcaTypeEnum.atr].includes(
            this.settings.scaleDcaType ?? ScaleDcaTypeEnum.percentage,
          )
        ) {
          continue
        }
        if (
          indicatorAction === IndicatorAction.closeDeal &&
          section !== IndicatorSection.sl &&
          this.settings.dealCloseCondition === CloseConditionEnum.dynamicAr &&
          this.settings.useTp
        ) {
          continue
        }
        if (
          indicatorAction === IndicatorAction.closeDeal &&
          section === IndicatorSection.sl &&
          this.settings.dealCloseConditionSL === CloseConditionEnum.dynamicAr &&
          this.settings.useSl
        ) {
          continue
        }
        if (type === IndicatorEnum.pc) {
          const [last] = [...data].sort((a, b) => b.time - a.time)
          const pcCondition =
            +(pcValue ?? '5') > 0 ? PCConditionEnum.up : PCConditionEnum.down
          action =
            (pcCondition === PCConditionEnum.down &&
              (last.value as PCResult).down) ||
            (pcCondition === PCConditionEnum.up && (last.value as PCResult).up)
        } else if (type === IndicatorEnum.st) {
          const [ld, pd] = [...data].sort((a, b) => b.time - a.time)
          const lastData = ld.value as SuperTrendResult
          const prevData = pd.value as SuperTrendResult
          action =
            (stCondition === STConditionEnum.up && lastData.direction === -1) ||
            (stCondition === STConditionEnum.down &&
              lastData.direction === 1) ||
            (stCondition === STConditionEnum.upToDown &&
              prevData.direction === -1 &&
              lastData.direction === 1) ||
            (stCondition === STConditionEnum.downToUp &&
              prevData.direction === 1 &&
              lastData.direction === -1)
        } else if (type === IndicatorEnum.div) {
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          const result = lastData.value as DIVResult
          const min = divMinCount ?? 2
          action =
            ((divType === DivTypeEnum.bear || divType === DivTypeEnum.abear) &&
              result.negdivergence >= min) ||
            ((divType === DivTypeEnum.hbear || divType === DivTypeEnum.abear) &&
              result.negdivergencehidden >= min) ||
            ((divType === DivTypeEnum.bull || divType === DivTypeEnum.abull) &&
              result.posdivergence >= min) ||
            ((divType === DivTypeEnum.hbull || divType === DivTypeEnum.abull) &&
              result.posdivergencehidden >= min)
        } else if (type === IndicatorEnum.qfl) {
          const [lastData] = [...data].sort((a, b) => b.time - a.time)
          action = (lastData.value as QFLResult).action
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
              lastData.type === IndicatorEnum.bbpb ||
              lastData.type === IndicatorEnum.kcpb ||
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
              prevData.type === IndicatorEnum.bbpb ||
              prevData.type === IndicatorEnum.kcpb ||
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
            if (trendFilter) {
              trendFilterAction =
                (trendFilterType === TrendFilterOperatorEnum.lower &&
                  lastData.value.trend === 1) ||
                (trendFilterType === TrendFilterOperatorEnum.higher &&
                  lastData.value.trend === 2) ||
                (trendFilterType === TrendFilterOperatorEnum.between &&
                  lastData.value.trend === 3)
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
            lastData.type === IndicatorEnum.dc &&
            prevData.type === IndicatorEnum.dc
          ) {
            last = lastData.value.price
            prev = prevData.value.price
            value =
              dcValue === DCValueEnum.lower
                ? lastData.value.low
                : dcValue === DCValueEnum.upper
                ? lastData.value.high
                : lastData.value.basis
            prevValue =
              dcValue === DCValueEnum.lower
                ? prevData.value.low
                : dcValue === DCValueEnum.upper
                ? prevData.value.high
                : prevData.value.basis
          }
          if (
            lastData.type === IndicatorEnum.atr &&
            prevData.type === IndicatorEnum.atr
          ) {
            last = lastData.value
            prev = prevData.value
          }
          if (
            lastData.type === IndicatorEnum.ath &&
            prevData.type === IndicatorEnum.ath
          ) {
            last = lastData.value
            prev = prevData.value
            value = Math.abs(+(indicatorValue ?? '70')) * -1
            prevValue = value
          }
          if (
            lastData.type === IndicatorEnum.adr &&
            prevData.type === IndicatorEnum.adr
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
                // eslint-disable-next-line prefer-const
                let [_, dataMA, prevMAData] = [
                  ...findMA.instance.currentData,
                ].sort((a, b) => b.time - a.time)
                if (
                  findMA.interval === i.interval ||
                  timeIntervalMap[findMA.interval] < timeIntervalMap[i.interval]
                ) {
                  ;[dataMA, prevMAData] = [...findMA.instance.currentData].sort(
                    (a, b) => b.time - a.time,
                  )
                }
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
            i.settings.type === IndicatorEnum.xo &&
            lastData.type === xOscillator1 &&
            prevData.type === xOscillator1
          ) {
            last = lastData.value.value
            prev = prevData.value.value

            const findXO = Strategy.indicators.find(
              (ii) => ii.id === `${xoUUID}@${nextBar.symbol}`,
            )
            if (findXO) {
              // eslint-disable-next-line prefer-const
              let [_, dataXO, prevXOData] = [
                ...findXO.instance.currentData,
              ].sort((a, b) => b.time - a.time)
              if (
                findXO.interval === i.interval ||
                timeIntervalMap[findXO.interval] < timeIntervalMap[i.interval]
              ) {
                ;[dataXO, prevXOData] = [...findXO.instance.currentData].sort(
                  (a, b) => b.time - a.time,
                )
              }
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
            (lastData.type === IndicatorEnum.bb ||
              lastData.type === IndicatorEnum.kc) &&
            (prevData.type === IndicatorEnum.bb ||
              prevData.type === IndicatorEnum.kc)
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
          if (type === IndicatorEnum.pp) {
            const [ld, pd] = [...data].sort((a, b) => b.time - a.time)
            const _lastData = ld.value as PriorPivotResult
            const _prevData = pd.value as PriorPivotResult
            if (!ppType || ppType === ppValueTypeEnum.price) {
              last = _lastData.price
              prev = _prevData.price
              value =
                ppValue === ppValueEnum.anyH
                  ? isNaN(_lastData.hh)
                    ? _lastData.lh
                    : _lastData.hh
                  : ppValue === ppValueEnum.anyL
                  ? isNaN(_lastData.ll)
                    ? _lastData.hl
                    : _lastData.ll
                  : ppValue === ppValueEnum.hh
                  ? _lastData.hh
                  : ppValue === ppValueEnum.hl
                  ? _lastData.hl
                  : ppValue === ppValueEnum.ll
                  ? _lastData.ll
                  : _lastData.lh
              prevValue =
                ppValue === ppValueEnum.anyH
                  ? isNaN(_prevData.hh)
                    ? _prevData.lh
                    : _prevData.hh
                  : ppValue === ppValueEnum.anyL
                  ? isNaN(_prevData.ll)
                    ? _prevData.hl
                    : _prevData.ll
                  : ppValue === ppValueEnum.hh
                  ? _prevData.hh
                  : ppValue === ppValueEnum.hl
                  ? _prevData.hl
                  : ppValue === ppValueEnum.ll
                  ? _prevData.ll
                  : _prevData.lh
              if (isNaN(value) || isNaN(prevValue)) {
                last = 0
                prev = 0
                value = 0
                prevValue = 0
              }
            }
            if (ppType === ppValueTypeEnum.event) {
              skipAction = true
              action =
                ((ppValue === ppValueEnum.sBullCHoCH ||
                  ppValue === ppValueEnum.SanyBull ||
                  ppValue === ppValueEnum.bullAnyCHoCH) &&
                  _lastData.sBullCHoCH) ||
                ((ppValue === ppValueEnum.sBearCHoCH ||
                  ppValue === ppValueEnum.SanyBear ||
                  ppValue === ppValueEnum.bearAnyCHoCH) &&
                  _lastData.sBearCHoCH) ||
                ((ppValue === ppValueEnum.sBullBoS ||
                  ppValue === ppValueEnum.SanyBull ||
                  ppValue === ppValueEnum.bullAnyBoS) &&
                  _lastData.sBullBoS) ||
                ((ppValue === ppValueEnum.sBearBoS ||
                  ppValue === ppValueEnum.SanyBear ||
                  ppValue === ppValueEnum.bearAnyBoS) &&
                  _lastData.sBearBoS) ||
                ((ppValue === ppValueEnum.iBullCHoCH ||
                  ppValue === ppValueEnum.IanyBull ||
                  ppValue === ppValueEnum.bullAnyCHoCH) &&
                  _lastData.iBullCHoCH) ||
                ((ppValue === ppValueEnum.iBearCHoCH ||
                  ppValue === ppValueEnum.IanyBear ||
                  ppValue === ppValueEnum.bearAnyCHoCH) &&
                  _lastData.iBearCHoCH) ||
                ((ppValue === ppValueEnum.iBullBoS ||
                  ppValue === ppValueEnum.IanyBull ||
                  ppValue === ppValueEnum.bullAnyBoS) &&
                  _lastData.iBullBoS) ||
                ((ppValue === ppValueEnum.iBearBoS ||
                  ppValue === ppValueEnum.IanyBear ||
                  ppValue === ppValueEnum.bearAnyBoS) &&
                  _lastData.iBearBoS)
            }
            if (ppType === ppValueTypeEnum.market) {
              skipAction = true
              action =
                (ppValue === ppValueEnum.bullMarket &&
                  _lastData.market === 'bull') ||
                (ppValue === ppValueEnum.bearMarket &&
                  _lastData.market === 'bear')
            }
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
            data.length >= 2 &&
            !skipAction
          ) {
            if (indicatorCondition === IndicatorStartConditionEnum.cd) {
              action =
                (this.math.gt(value, last) && this.math.lt(prevValue, prev)) ||
                (this.math.gt(value, last) && this.math.lte(prevValue, prev))
            }
            if (indicatorCondition === IndicatorStartConditionEnum.cu) {
              action =
                (this.math.lt(value, last) && this.math.gt(prevValue, prev)) ||
                (this.math.lt(value, last) && this.math.gte(prevValue, prev))
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
        if (trendFilter) {
          action = trendFilterAction && action
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
      const stopBot = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.stopBot &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const startBot = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.startBot &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const startDca = [...Strategy.indicators].filter(
        (i) =>
          i.settings.indicatorAction === IndicatorAction.startDca &&
          !i.ignore &&
          i.symbol === nextBar.symbol,
      )
      const filterFn = (i: Indicator) =>
        i.status.status &&
        i.status.statusSince <= nextBar.time &&
        i.status.statusTo >= nextBar.time
      const closeDealSlStatus = closeDealSl.filter(filterFn)
      const closeDealTpStatus = closeDealTp.filter(filterFn)
      const startDealStatus = startDeal.filter(filterFn)
      const stopBotStatus = stopBot.filter(filterFn)
      const startBotStatus = startBot.filter(filterFn)
      const startDcaStatus = startDca.filter(filterFn)
      const closeDealSlGroupsStatus = !closeDealSl.length
        ? []
        : this.settings.indicatorGroups
            .filter(
              (ig) =>
                ig.action === IndicatorAction.closeDeal &&
                ig.section === IndicatorSection.sl,
            )
            .map((ig) => {
              const findAll = closeDealSl.filter((i) => i.groupId === ig.id)
              const findAllStatus = closeDealSlStatus.filter(
                (i) => i.groupId === ig.id,
              )
              return !!(ig.logic === IndicatorsLogicEnum.or
                ? findAllStatus.length > 0
                : findAll.length && findAll.length === findAllStatus.length)
            })
      if (
        (this.settings.stopDealSlLogic === IndicatorsLogicEnum.and ||
        !this.settings.stopDealSlLogic
          ? closeDealSlGroupsStatus.every((r) => !!r)
          : closeDealSlGroupsStatus.some((r) => !!r)) &&
        closeDealSlGroupsStatus.length
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
            return {
              ...i,
              status: {
                ...i.status,
                status: i.status.statusTo
                  ? i.status.statusTo >
                    timeIntervalMap[i.interval] + nextBar.time
                    ? i.status.status
                    : false
                  : false,
              },
            }
          }
          return i
        })
      }
      const stopBotGroupsStatus = !stopBot.length
        ? []
        : this.settings.indicatorGroups
            .filter((ig) => ig.action === IndicatorAction.stopBot)
            .map((ig) => {
              const findAll = stopBot.filter((i) => i.groupId === ig.id)
              const findAllStatus = stopBotStatus.filter(
                (i) => i.groupId === ig.id,
              )
              return !!(ig.logic === IndicatorsLogicEnum.or
                ? findAllStatus.length > 0
                : findAll.length && findAll.length === findAllStatus.length)
            })
      if (
        (this.settings.stopBotLogic === IndicatorsLogicEnum.and ||
        !this.settings.stopBotLogic
          ? stopBotGroupsStatus.every((r) => !!r)
          : stopBotGroupsStatus.some((r) => !!r)) &&
        stopBotGroupsStatus.length &&
        Strategy.status === 'open' &&
        !Strategy.preventOpen
      ) {
        this.stopByIndicator({
          open: /* lowestBar?.open ?? */ nextBar.open,
          time: nextBar.time,
          high: /*  lowestBar?.open ??  */ nextBar.high,
          low: /*  lowestBar?.low ?? */ nextBar.low,
          close: /* lowestBar?.close ??  */ nextBar.close,
          symbol: nextBar.symbol,
        })

        Strategy.indicators = Strategy.indicators.map((i) => {
          if (stopBotStatus.map((ai) => ai.id).includes(i.id)) {
            return {
              ...i,
              status: {
                ...i.status,
                status: i.status.statusTo
                  ? i.status.statusTo >
                    timeIntervalMap[i.interval] + nextBar.time
                    ? i.status.status
                    : false
                  : false,
              },
            }
          }
          return i
        })
      }
      const startBotGroupsStatus = !startBot.length
        ? []
        : this.settings.indicatorGroups
            .filter((ig) => ig.action === IndicatorAction.startBot)
            .map((ig) => {
              const findAll = startBot.filter((i) => i.groupId === ig.id)
              const findAllStatus = startBotStatus.filter(
                (i) => i.groupId === ig.id,
              )
              return !!(ig.logic === IndicatorsLogicEnum.or
                ? findAllStatus.length > 0
                : findAll.length && findAll.length === findAllStatus.length)
            })
      if (
        (this.settings.startBotLogic === IndicatorsLogicEnum.and ||
        !this.settings.startBotLogic
          ? startBotGroupsStatus.every((r) => !!r)
          : startBotGroupsStatus.some((r) => !!r)) &&
        startBotGroupsStatus.length &&
        Strategy.preventOpen &&
        Strategy.status === 'monitoring'
      ) {
        Strategy.preventOpen = false
        Strategy.status = 'open'
        Strategy.indicators = Strategy.indicators.map((i) => {
          if (startBotStatus.map((ai) => ai.id).includes(i.id)) {
            return {
              ...i,
              status: {
                ...i.status,
                status: i.status.statusTo
                  ? i.status.statusTo >
                    timeIntervalMap[i.interval] + nextBar.time
                    ? i.status.status
                    : false
                  : false,
              },
            }
          }
          return i
        })
      }
      const closeDealTpGroupsStatus = !closeDealTp.length
        ? []
        : this.settings.indicatorGroups
            .filter(
              (ig) =>
                ig.action === IndicatorAction.closeDeal &&
                ig.section !== IndicatorSection.sl,
            )
            .map((ig) => {
              const findAll = closeDealTp.filter((i) => i.groupId === ig.id)
              const findAllStatus = closeDealTpStatus.filter(
                (i) => i.groupId === ig.id,
              )
              return !!(ig.logic === IndicatorsLogicEnum.or
                ? findAllStatus.length > 0
                : findAll.length && findAll.length === findAllStatus.length)
            })
      if (
        (this.settings.stopDealLogic === IndicatorsLogicEnum.and ||
        !this.settings.stopDealLogic
          ? closeDealTpGroupsStatus.every((r) => !!r)
          : closeDealTpGroupsStatus.some((r) => !!r)) &&
        closeDealTpGroupsStatus.length
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
            return {
              ...i,
              status: {
                ...i.status,
                status: i.status.statusTo
                  ? i.status.statusTo >
                    timeIntervalMap[i.interval] + nextBar.time
                    ? i.status.status
                    : false
                  : false,
              },
            }
          }
          return i
        })
      }
      const startDealGroupsStatus = !startDeal.length
        ? []
        : this.settings.indicatorGroups
            .filter((ig) => ig.action === IndicatorAction.startDeal)
            .map((ig) => {
              const findAll = startDeal.filter((i) => i.groupId === ig.id)
              const findAllStatus = startDealStatus.filter(
                (i) => i.groupId === ig.id,
              )
              return !!(ig.logic === IndicatorsLogicEnum.or
                ? findAllStatus.length > 0
                : findAll.length && findAll.length === findAllStatus.length)
            })
      if (
        (this.settings.startDealLogic === IndicatorsLogicEnum.and ||
        !this.settings.startDealLogic
          ? startDealGroupsStatus.every((r) => !!r)
          : startDealGroupsStatus.some((r) => !!r)) &&
        startDealGroupsStatus.length
      ) {
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
        const useMaxDealsPerSignal =
          this.settings.indicators
            .filter((i) => i.indicatorAction === IndicatorAction.startDeal)
            .reduce(
              (acc, v) => acc.add(v.indicatorInterval),
              new Set<ExchangeIntervals>(),
            ).size > 1
            ? typeof this.settings.useMaxDealsPerHigherTimeframe !== 'undefined'
              ? !!this.settings.useMaxDealsPerHigherTimeframe
              : true
            : false
        const maxDealsPerSignal =
          typeof this.settings.useMaxDealsPerHigherTimeframe !== 'undefined'
            ? !this.settings.useMaxDealsPerHigherTimeframe
              ? Infinity
              : +(this.settings.maxDealsPerHigherTimeframe ?? '1')
            : 1
        Strategy.indicators = Strategy.indicators.map((i) => {
          if (startDealStatus.map((ai) => ai.id).includes(i.id)) {
            const maxNumberExceed =
              i.interval === Strategy.highestInterval &&
              useMaxDealsPerSignal &&
              (i.status.numberOfSignals ?? 0) + 1 >= maxDealsPerSignal
            return {
              ...i,
              status: maxNumberExceed
                ? {
                    status: false,
                    statusSince: 0,
                    statusTo: 0,
                    numberOfSignals: 0,
                  }
                : {
                    ...i.status,
                    status: i.status.statusTo
                      ? i.status.statusTo > nextBar.time
                        ? i.status.status
                        : false
                      : false,
                    numberOfSignals:
                      i.interval === Strategy.highestInterval
                        ? (i.status?.numberOfSignals ?? 0) + 1
                        : i.status.numberOfSignals,
                  },
            }
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
              return {
                ...i,
                status: {
                  ...i.status,
                  status: i.status.statusTo
                    ? i.status.statusTo >
                      timeIntervalMap[i.interval] + nextBar.time
                      ? i.status.status
                      : false
                    : false,
                },
              }
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
