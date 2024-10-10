import {
  BotStartTypeEnum,
  CloseConditionEnum,
  DCAConditionEnum,
  IndicatorEnum,
  ScaleDcaTypeEnum,
  StartConditionEnum,
} from '../../types'
import createStrategyFactory from './factory'
import ASAPStrategy from './asap'
import TIStrategy from './ti'
import TimerStrategy from './timer'
import EdgeRandomStrategy from './edge/random'

import { DCABotSettings, EdgeBacktestEnum } from '../../types'

const getStrategyBySettings = (
  settings: DCABotSettings,
  edge?: EdgeBacktestEnum,
) => {
  if (edge === EdgeBacktestEnum.random) {
    return [createStrategyFactory(EdgeRandomStrategy)]
  }
  let result: ReturnType<typeof createStrategyFactory>[] = [
    createStrategyFactory(ASAPStrategy),
  ]
  if (settings.startCondition === StartConditionEnum.ti) {
    result = [createStrategyFactory(TIStrategy)]
  }
  if (settings.startCondition === StartConditionEnum.timer) {
    result = [createStrategyFactory(TimerStrategy)]
  }
  if (
    (((settings.dealCloseCondition === CloseConditionEnum.techInd ||
      settings.dealCloseCondition === CloseConditionEnum.dynamicAr) &&
      settings.useTp &&
      settings.startCondition !== StartConditionEnum.ti) ||
      ((settings.dealCloseConditionSL === CloseConditionEnum.techInd ||
        settings.dealCloseCondition === CloseConditionEnum.dynamicAr) &&
        settings.useSl &&
        settings.startCondition !== StartConditionEnum.ti) ||
      ((settings.dcaCondition === DCAConditionEnum.indicators ||
        ((settings.dcaCondition === DCAConditionEnum.percentage ||
          !settings.dcaCondition) &&
          [ScaleDcaTypeEnum.adr, ScaleDcaTypeEnum.atr].includes(
            settings.scaleDcaType ?? ScaleDcaTypeEnum.percentage,
          ))) &&
        settings.useDca &&
        settings.startCondition !== StartConditionEnum.ti) ||
      (settings.useBotController &&
        settings.botStart === BotStartTypeEnum.indicators &&
        settings.startCondition !== StartConditionEnum.ti) ||
      (settings.useRiskReward &&
        settings.startCondition !== StartConditionEnum.ti)) &&
    settings.indicators.filter((i) => i.type !== IndicatorEnum.unpnl).length > 0
  ) {
    result.push(createStrategyFactory(TIStrategy))
  }
  return result
}

export type { StrategyInterface } from './main'

export default getStrategyBySettings
