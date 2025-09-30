import type { Prices } from '../types'

const findAsset = (base: string, quote: string) => (p: Prices[0]) => {
  const pr = p.symbol.split('_')[0]
  return (
    pr === `${base}${quote}` ||
    pr === `${base}-${quote}` ||
    pr === `${base}/${quote}` ||
    pr === `${base}Z${quote}`
  )
}

const findRate = (
  base: string,
  quote: string,
  prices: Prices,
  reverse = false,
): number | undefined => {
  const rate = prices.find(findAsset(base, quote))
  if (rate) {
    return reverse ? 1 / rate.price : rate.price
  }
  if (!reverse) {
    return findRate(quote, base, prices, true)
  }
}

const findUSDRate = (asset: string, _prices: Prices, exchange?: string) => {
  const prices = _prices.filter((p) =>
    exchange ? [exchange, 'all'].includes(p.exchange ?? '') : true,
  )
  if (asset === 'USD') {
    return 1
  }
  let usdRate = Number(asset === 'USDT' || asset === 'USDC')
  let usdtRate = Number(asset === 'USDT' || asset === 'USDC')
  if (asset !== 'USDT') {
    const findUsdtRate = findRate(asset, 'USDT', prices)
    if (findUsdtRate) {
      usdtRate = findUsdtRate
      usdRate = usdtRate
    } else {
      const _findUsdRate = findRate(asset, 'USD', prices)
      if (_findUsdRate) {
        return _findUsdRate
      }
      const findBtcRate = findRate(asset, 'BTC', prices)
      if (findBtcRate) {
        const findBtcUsdtRate = findRate('BTC', 'USDT', prices)
        if (findBtcUsdtRate) {
          usdtRate = findBtcRate * findBtcUsdtRate
          usdRate = usdtRate
        }
      }
    }
  }
  const findUsdtUsdRate = findRate('USDT', 'USD', prices)
  if (findUsdtUsdRate) {
    usdRate = usdtRate * findUsdtUsdRate
  }
  return usdRate
}

export default findUSDRate
