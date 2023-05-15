import { MathHelper } from './math'

import type { Symbols } from '../types'

class BotUtils {
  public math: MathHelper

  constructor() {
    this.math = new MathHelper()
  }

  getPrecision(symbol?: Symbols) {
    return {
      base: symbol ? this.getBaseAssetPrecision(symbol) : 8,
      quote: symbol
        ? this.math.getPrecision(
            symbol.quoteAsset.minAmount || symbol.baseAsset.minAmount,
            true,
          )
        : 8,
      price: symbol ? symbol.priceAssetPrecision : 8,
    }
  }

  getBaseAssetPrecision(symbol: Symbols) {
    let use = `${symbol.baseAsset.step}`
    if (use.indexOf('e-') !== -1) {
      const split = use.split('e-')[1]
      use = Number(symbol.baseAsset.step).toFixed(parseFloat(split))
    }
    if (use.indexOf('1') === -1) {
      const dec = use.replace('0.', '')
      const numbers = dec.replace(/0/g, '')
      const place = dec.indexOf(numbers)
      if (place <= 1) {
        return place
      }
      use = `0.${'0'.repeat(place)}1`
    }
    return use.indexOf('1') === 0 ? 0 : use.replace('0.', '').indexOf('1') + 1
  }

  id(length: number): string {
    let result = ''
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }
}

export default BotUtils
