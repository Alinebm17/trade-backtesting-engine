import {
  ExchangeEnum,
  ExchangeIntervals,
  tvIntervalMap,
  timeIntervalMap,
} from './types'
import { MathHelper } from './helper/math'
import type {
  Symbols,
  BacktestingInput,
  PeriodParams,
  ResolutionString,
  LoadDataFn,
} from './types'

class Backtesting {
  public exchange: ExchangeEnum

  public period: PeriodParams

  protected readonly symbol: Symbols

  public interval: ExchangeIntervals

  private readonly counBack: number = 10000

  protected readonly math: MathHelper = new MathHelper()

  private readonly from?: number

  private readonly to?: number

  private loadFn?: LoadDataFn

  constructor({
    exchange,
    symbol,
    interval,
    from,
    to,
  }: BacktestingInput<unknown>) {
    this.exchange = exchange
    this.interval = interval ?? ExchangeIntervals.fiveM
    this.symbol = symbol
    this.from = from
    this.to = to
    this.period = this.calculatePeriod(this.interval)
  }

  public calculatePeriod(
    interval: ExchangeIntervals,
    from?: number,
  ): PeriodParams {
    const time = timeIntervalMap[interval]
    const now = new Date()
    if (this.from) {
      const to = this.to ? new Date(this.to) : new Date()
      const fr = new Date(this.from)
      return {
        to: to.getTime() / 1000,
        from: fr.getTime() / 1000,
        countBack: this.counBack,
        firstDataRequest: false,
      }
    }
    if (from) {
      const nowTime = now.getTime()
      const _from = new Date(from * 1000)
      const fromTime = _from.getTime()
      return {
        to: Math.ceil(nowTime / 1000),
        from: Math.ceil(fromTime / 1000),
        countBack: Math.floor((nowTime - fromTime) / time),
        firstDataRequest: false,
      }
    }
    const _from = now.getTime() - time * this.counBack
    now.setHours(23, 59, 0, 0)
    const nowTime = now.getTime()
    const fromDate = new Date(_from)
    fromDate.setHours(0, 0, 0, 0)
    return {
      to: Math.ceil(nowTime / 1000),
      from: Math.ceil(fromDate.getTime() / 1000),
      countBack: this.counBack,
      firstDataRequest: false,
    }
  }

  set loadData(loadFn: LoadDataFn) {
    this.loadFn = loadFn
  }

  public async _loadData(int?: ExchangeIntervals, from?: number) {
    const {
      symbol: { pair },
      interval,
      period,
    } = this
    const local = localStorage.getItem(pair)
    if (local) {
      return JSON.parse(local)
    }
    const resolution = tvIntervalMap[int ?? interval] as ResolutionString
    let periodToUse = period
    if (int && int !== interval) {
      periodToUse = this.calculatePeriod(int, from)
    }
    if (this.loadFn) {
      const result = await this.loadFn(
        pair,
        resolution,
        periodToUse,
        this.exchange,
      )
      localStorage.setItem(pair, JSON.stringify(result))

      return result
    }
    return []
  }
}

export default Backtesting
