import { CloseConditionEnum, StartConditionEnum } from '../../types'
import createStrategyFactory from './factory'
import ASAPStrategy from './asap'
import TIStrategy from './ti'
import TimerStrategy from './timer'

import type { DCABotSettings } from '../../types'

const getStrategyBySettings = (settings: DCABotSettings) => {
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
      settings.startCondition !== StartConditionEnum.ti) ||
    (settings.dealCloseConditionSL === CloseConditionEnum.techInd &&
      settings.startCondition !== StartConditionEnum.ti)
  ) {
    result.push(createStrategyFactory(TIStrategy))
  }
  return result
}

export type { StrategyInterface } from './main'

export default getStrategyBySettings
