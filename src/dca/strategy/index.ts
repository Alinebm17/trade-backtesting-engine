import {
  BotStartTypeEnum,
  CloseConditionEnum,
  DCAConditionEnum,
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
    (settings.dealCloseCondition === CloseConditionEnum.techInd &&
      settings.useTp &&
      settings.startCondition !== StartConditionEnum.ti) ||
    (settings.dealCloseConditionSL === CloseConditionEnum.techInd &&
      settings.useSl &&
      settings.startCondition !== StartConditionEnum.ti) ||
    (settings.dcaCondition === DCAConditionEnum.indicators &&
      settings.useDca &&
      settings.startCondition !== StartConditionEnum.ti) ||
    (settings.useBotController &&
      settings.botStart === BotStartTypeEnum.indicators &&
      settings.startCondition !== StartConditionEnum.ti) ||
    (settings.useRiskReward &&
      settings.startCondition !== StartConditionEnum.ti)
  ) {
    result.push(createStrategyFactory(TIStrategy))
  }
  return result
}

export type { StrategyInterface } from './main'

export default getStrategyBySettings
