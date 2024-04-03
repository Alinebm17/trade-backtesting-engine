/* eslint-disable @typescript-eslint/no-var-requires */
import {
  ExchangeEnum,
  ExchangeIntervals,
  tvIntervalMap,
  timeIntervalMap,
  DirName,
} from './types'
import { MathHelper } from './helper/math'
import type {
  Symbols,
  BacktestingInput,
  PeriodParams,
  ResolutionString,
  LoadDataFn,
  FullBar,
  SavedBar,
} from './types'
import { v4 } from 'uuid'

type SaveFileFn = (
  fileName: string,
  data: FullBar[],
  interval?: ExchangeIntervals,
  sort?: boolean,
  updateProgress?: (value: number, text: string) => void,
  random?: boolean,
) => Promise<void>

let saveFile: SaveFileFn | undefined

if (typeof window === 'undefined') {
  const deserializer = (x: string): SavedBar => {
    if (x === 'o;h;l;c;v;t;s;i') {
      return {
        open: -1,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
        time: 0,
        symbol: '',
        interval: ExchangeIntervals.oneM,
      }
    }
    const [open, high, low, close, volume, time, symbol, _interval] =
      x.split(';')
    return {
      open: +open,
      high: +high,
      low: +low,
      close: +close,
      volume: +volume,
      time: +time,
      symbol: symbol,
      interval: _interval as ExchangeIntervals,
    }
  }
  const serializer = (d: SavedBar) => {
    if (d.open === -1) {
      return 'o;h;l;c;v;t;s;i'
    }
    return `${d.open};${d.high};${d.low};${d.close};${d.volume};${d.time};${d.symbol};${d.interval}`
  }
  const fs = require('fs')
  const esort = require('external-sorting').default
  const path = require('path')
  const dir = path.join(__dirname, DirName)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  saveFile = async (
    fileName: string,
    data: FullBar[],
    interval?: ExchangeIntervals,
    sort?: boolean,
    updateProgress?: (value: number, text: string) => void,
    random = false,
  ) => {
    const file = `${dir}/${fileName}.csv`

    const sortedFile = `${dir}/${fileName}-sorted.csv`
    if (data.length) {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, 'o;h;l;c;v;t;s;i\n')
      }
      fs.appendFileSync(
        file,
        data
          .map(
            (d) =>
              `${d.open};${d.high};${d.low};${d.close};${d.volume};${d.time};${d.symbol};${interval}\n`,
          )
          .join(''),
      )
    }

    if (sort) {
      const tempDir = `${dir}/${v4()}`
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      if (updateProgress) {
        updateProgress(0, `Start sorting of ${file}`)
      }
      let skip = false
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, 'o;h;l;c;v;t;s;i\n')
        skip = true
      }
      if (!skip) {
        const sortOptions = {
          deserializer,
          serializer,
          tempDir,
          maxHeap: 10000,
        }
        await esort({
          ...sortOptions,
          input: fs.createReadStream(file),
          output: fs.createWriteStream(sortedFile),
        }).asc([
          (obj: SavedBar) => obj.time,
          (obj: SavedBar) =>
            random
              ? Math.random() - 0.5
              : [...obj.symbol.toLowerCase()].map((c) => parseInt(c, 36)),
          (obj: SavedBar) => timeIntervalMap[obj.interval],
        ])
        fs.unlinkSync(file)
        fs.renameSync(sortedFile, file)
      }
      fs.rmSync(tempDir, { recursive: true, force: true })
      if (updateProgress) {
        updateProgress(0, `End sorting of ${file}`)
      }
      if (skip) {
        throw 'No data to loaded, refund backtest'
      }
    }
  }
}

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

  public useFile?: boolean

  public fileName: string

  constructor(
    {
      exchange,
      symbols,
      interval,
      from,
      to,
      trades,
      useFile,
    }: BacktestingInput<unknown>,
    fileName: string,
  ) {
    this.exchange = exchange
    this.interval = interval ?? ExchangeIntervals.fiveM
    symbols.forEach((s) => {
      this.symbols.set(s.pair, s)
    })
    this.from = from
    this.to = to
    this.period = this.calculatePeriod(this.interval)
    this.trades = trades
    this.useFile = useFile && typeof window === 'undefined'
    this.fileName = fileName
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

  public async sortData(
    updateProgress?: (value: number, text: string) => void,
    random?: boolean,
  ) {
    if (this.useFile && saveFile) {
      await saveFile(this.fileName, [], undefined, true, updateProgress, random)
    }
  }

  public async _loadData(
    int?: ExchangeIntervals,
    from?: number,
    periodParam?: PeriodParams,
    index?: number,
    total?: number,
    random = false,
  ): Promise<FullBar[]> {
    const { symbols, interval, period } = this
    const resolution = tvIntervalMap[int ?? interval] as ResolutionString
    let periodToUse = periodParam || period
    if (int && int !== interval && !periodParam) {
      periodToUse = this.calculatePeriod(int, from)
    }
    if (this.loadFn) {
      let data: FullBar[] = []
      let si = 0
      for (const s of symbols.values()) {
        const result = await this.loadFn(
          s.pair,
          s.baseAsset.name,
          s.quoteAsset.name,
          resolution,
          periodToUse,
          this.exchange,
          (index ?? 0) * symbols.size + si,
          (total ?? 1) * symbols.size,
        )
        si++
        const fullResult = result.map((r) => ({ ...r, symbol: s.pair }))
        if (this.useFile && saveFile) {
          await saveFile(this.fileName, fullResult, int ?? interval)
        } else {
          data = data.concat(fullResult)
        }
      }
      return data.sort((a, b) => {
        if (a.time === b.time) {
          return random
            ? Math.random() > 0.5
              ? 1
              : -1
            : `${a.symbol}`.localeCompare(`${b.symbol}`)
        }
        return a.time - b.time
      })
    }
    return []
  }
}

export default Backtesting
