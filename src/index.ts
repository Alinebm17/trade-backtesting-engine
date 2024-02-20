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
  Bar,
} from './types'

class Backtesting {
  public exchange: ExchangeEnum

  public period: PeriodParams

  protected readonly symbols: Map<string, Symbols> = new Map()

  public interval: ExchangeIntervals

  private readonly counBack: number = 10000

  protected readonly math: MathHelper = new MathHelper()

  public from?: number

  public to?: number

  private loadFn?: LoadDataFn

  public trades?: boolean

  public _stop = false

  constructor({
    exchange,
    symbols,
    interval,
    from,
    to,
    trades,
  }: BacktestingInput<unknown>) {
    this.exchange = exchange
    this.interval = interval ?? ExchangeIntervals.fiveM
    symbols.forEach((s) => {
      this.symbols.set(s.pair, s)
    })
    this.from = from
    this.to = to
    this.period = this.calculatePeriod(this.interval)
    this.trades = trades
  }

  public set stop(value: boolean) {
    this._stop = value
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
    now.setUTCHours(23, 59, 0, 0)
    const nowTime = now.getTime()
    const fromDate = new Date(_from)
    fromDate.setUTCHours(0, 0, 0, 0)
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

  public async _loadData(
    int?: ExchangeIntervals,
    from?: number,
    periodParam?: PeriodParams,
    index?: number,
    total?: number,
  ): Promise<(Bar & { symbol: string })[]> {
    const { symbols, interval, period } = this
    const resolution = tvIntervalMap[int ?? interval] as ResolutionString
    let periodToUse = periodParam || period
    if (int && int !== interval && !periodParam) {
      periodToUse = this.calculatePeriod(int, from)
    }
    if (this.loadFn) {
      let data: (Bar & { symbol: string })[] = []
      let si = 0
      for (const s of symbols.values()) {
        const result = await this.loadFn(
          s.pair,
          s.baseAsset.name,
          s.quoteAsset.name,
          resolution,
          periodToUse,
          this.exchange,
          (index ?? 1) * (symbols.size === 1 ? 1 : index ?? 1) + si,
          (total ?? 1) * symbols.size,
        )
        si++

        data = data.concat(result.map((r) => ({ ...r, symbol: s.pair })))
      }
      return data.sort((a, b) => {
        if (a.time === b.time) {
          return `${a.symbol}`.localeCompare(`${b.symbol}`)
        }
        return a.time - b.time
      })
    }
    return []
  }
}

export default Backtesting
