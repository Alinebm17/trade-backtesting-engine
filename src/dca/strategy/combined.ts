/* eslint-disable @typescript-eslint/no-var-requires */
import { Strategy, StrategyInterface } from './main'

import type { StrategyInput } from './main'

import type { ExchangeIntervals, FullBar, TradeResponse } from '../../types'

import { timeIntervalMap, DirName } from '../../types'

let getFileLinesSync: (
  file: string,
  encoding: BufferEncoding,
) => Generator<string, void, unknown> | undefined

if (typeof window === 'undefined') {
  getFileLinesSync = function* (filename: string, encoding: BufferEncoding) {
    const fs = require('fs')
    const string_decoder = require('string_decoder')
    const fd = fs.openSync(filename, 'r')
    const buf = Buffer.allocUnsafe(32768)
    let pos = 0
    const decoder = new string_decoder.StringDecoder(encoding || 'UTF8')
    let lineStart = ''

    while (true) {
      // Read buffer
      const bytesRead = fs.readSync(fd, buf, 0, buf.length, pos)
      pos += bytesRead

      // Decode string
      let str
      if (bytesRead < buf.length)
        str = lineStart + decoder.end(buf.subarray(0, bytesRead))
      else str = lineStart + decoder.write(buf)

      // Split into lines and yield the complete ones
      const lines = str.split(/\r?\n/)
      for (let i = 0; i < lines.length - 1; i++) {
        yield lines[i]
      }

      // The last line is the start of the first line in the next chunk
      lineStart = lines[lines.length - 1]

      // quit if eof
      if (bytesRead < buf.length) break
    }

    // Final line
    yield lineStart

    fs.closeSync(fd)
  }
}

class CombinedStrategy extends Strategy implements StrategyInterface {
  private strategies: StrategyInterface[] = []

  private i = 0

  private total = 0

  private step = 0

  private fileName

  constructor(
    input: StrategyInput,
    fileName: string,
    ...strategies: ((args: StrategyInput) => StrategyInterface)[]
  ) {
    Strategy.resetData()
    super(input)
    this.strategies = strategies.map((s) => s(input))
    Strategy.fullResult = input.fullResult
    Strategy.useFile = input.useFile && typeof window === 'undefined'
    this.fileName = fileName
  }

  public async test(
    _start: number,
    end: number,
    updateProgress?: (value: number, text: string) => void,
    total?: number,
  ): Promise<void> {
    const data = [...Strategy.data].sort(
      (a, b) => timeIntervalMap[a.interval] - timeIntervalMap[b.interval],
    )
    const [lowest] = data
    if (!lowest) {
      return
    }
    const start = Strategy.start || _start
    let step = start !== 0 && end !== 0 ? (end - start) / 100 : 0
    if (step < timeIntervalMap[lowest.interval]) {
      step = timeIntervalMap[lowest.interval]
    }
    const current: Map<string, number> = new Map()
    Strategy.lowestInterval = lowest.interval
    Strategy.interval = lowest.interval
    await this.preTest()
    const last: Map<string, FullBar> = new Map()
    if (Strategy.useFile) {
      const fs = require('fs')
      const path = require('path')
      const dir = path.join(__dirname, `../../${DirName}`)
      const file = `${dir}/${this.fileName}.csv`
      if (fs.existsSync(dir) && fs.existsSync(file)) {
        const size =
          total ||
          ((end - start) / timeIntervalMap[lowest.interval]) *
            this.settings.pair.length
        const _data = getFileLinesSync(file, 'utf-8')
        if (_data) {
          for (const d of _data) {
            if (this._stop) {
              return
            }
            if (d === 'o;h;l;c;v;t;s;i' || !d) {
              continue
            }
            const [open, high, low, close, volume, time, symbol, interval] =
              d.split(';')
            const bar = {
              open: +open,
              high: +high,
              low: +low,
              close: +close,
              volume: +volume,
              time: +time,
              symbol: symbol,
              interval: interval as ExchangeIntervals,
            }
            const _current = current.get(bar.symbol) || start
            const checkPortfolio =
              Strategy.lowestInterval === bar.interval &&
              (_current === start || bar.time >= _current)
            if (checkPortfolio) {
              current.set(bar.symbol, _current + step)
            }
            await this.processBar(
              checkPortfolio,
              bar,
              bar.interval as ExchangeIntervals,
              updateProgress,
              size,
            )
            if (Strategy.lowestInterval === bar.interval) {
              last.set(bar.symbol, bar)
            }
          }
          for (const b of last.values()) {
            if (Strategy.portfolio.has(b.time)) {
              continue
            }
            this.checkPortfolio(b.time, b.close, b.symbol)
          }
          return
        }
      }
    }
    for (const b of lowest.bar) {
      if (this._stop) {
        return
      }
      const _current = current.get(b.symbol) || start
      const checkPortfolio = _current === start || b.time >= _current
      if (checkPortfolio) {
        current.set(b.symbol, _current + step)
      }
      last.set(b.symbol, b)
      await this.processBar(
        checkPortfolio,
        b,
        lowest.interval,
        updateProgress,
        lowest.bar.length,
      )
    }
    for (const b of last.values()) {
      if (Strategy.portfolio.has(b.time)) {
        continue
      }
      this.checkPortfolio(b.time, b.close, b.symbol)
    }
  }

  public async preTest(): Promise<void> {
    for (const s of this.strategies) {
      if (this._stop) {
        return
      }
      await s.preTest()
    }
  }

  public async processBar(
    checkPortfolio: boolean,
    b: FullBar,
    interval: ExchangeIntervals,
    updateProgress?: (value: number, text: string) => void,
    _size?: number,
  ): Promise<void> {
    if (interval === Strategy.lowestInterval) {
      const size = _size || Strategy?.data?.[0]?.bar?.length || 0
      if (this.step === 0 && this.total === 0 && updateProgress) {
        updateProgress(
          0,
          `Processing candle on ${new Date(b.time).toUTCString()}`,
        )
      }
      if (size !== 0 && updateProgress) {
        if (this.step === 0) {
          this.step = Math.floor(size * 0.03)
        }
        if (this.total === 0) {
          this.total = size
        }

        if (this.math.remainder(this.i, this.step) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 15))
          updateProgress(
            this.i / this.total,
            `Processing ${b.symbol} candle on ${new Date(
              b.time,
            ).toUTCString()}`,
          )
        }
        this.i++
      }
    }
    for (const s of this.strategies) {
      if (this._stop) {
        return
      }
      await s.processBar(checkPortfolio, b, interval)
    }
  }

  public passTradeCandleData(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ) {
    this.processTrade(trade, candles)
  }

  public processTrade(
    trade: TradeResponse,
    candles: { candle: FullBar[] | null; interval: ExchangeIntervals }[],
  ): void {
    for (const s of this.strategies) {
      if (this._stop) {
        return
      }
      s.processTrade(trade, candles)
    }
  }

  public override getOtherIntervals(): {
    interval: ExchangeIntervals
    countBack: number
  }[] {
    const map: Map<ExchangeIntervals, number> = new Map()
    for (const s of this.strategies) {
      for (const i of s.getOtherIntervals()) {
        map.set(i.interval, Math.max(map.get(i.interval) ?? 0, i.countBack))
      }
    }
    return Array.from(map).map(([k, v]) => ({ interval: k, countBack: v }))
  }
}

export default CombinedStrategy
