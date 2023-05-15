import { Strategy, StrategyInput } from './main'

type StrategyArgs = [StrategyInput]

interface BoundStrategyType<T> extends Function {
  new (...args: StrategyArgs): T
}

export default function createStrategyFactory<T extends Strategy>(
  TargetStrategy: BoundStrategyType<T>,
) {
  return (...args: StrategyArgs) => new TargetStrategy(...args)
}
