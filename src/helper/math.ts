export class MathHelper {
  private eps = 1e-10

  convertFromExponential(num: number | string, precision = 2) {
    return Number(num)
      .toFixed(Math.min(precision, 20))
      .replace(/0*$/, '')
      .replace(/\.*$/, '')
  }

  round(_num: number, precision = 2, down = false, up = false) {
    let num = `${_num}`
    if (`${_num}`.indexOf('e') !== -1) {
      num = this.convertFromExponential(_num, precision + 2)
    }
    const intPart = num.split('.')[0]
    if ((intPart?.length ?? 0) + precision > 20) {
      precision = 20 - intPart.length
    }
    if (down) {
      const res = Number(
        `${Math.floor(Number(`${num}e${precision}`))}e-${precision}`,
      )
      return isNaN(res) ? 0 : res
    }
    if (up) {
      const res = Number(
        `${Math.ceil(Number(`${num}e${precision}`))}e-${precision}`,
      )
      return isNaN(res) ? 0 : res
    }
    const res = Number(
      `${Math.round(Number(`${num}e${precision}`))}e-${precision}`,
    )
    return isNaN(res) ? 0 : res
  }

  friendly(n: number) {
    const number = Math.abs(n)
    const num = Math.abs(n)
      .toString()
      .replace(/[^0-9.]/g, '')
    let minus = ''
    if (n < 0) {
      minus = '-'
    }

    if (number < 10000) {
      return `${minus}${num}`
    }
    const si = [
      { v: 1e3, s: 'K' },
      { v: 1e6, s: 'M' },
      { v: 1e9, s: 'B' },
      { v: 1e12, s: 'T' },
      { v: 1e15, s: 'P' },
      { v: 1e18, s: 'E' },
    ]
    let index
    for (index = si.length - 1; index > 0; index--) {
      if (number >= si[index].v) {
        break
      }
    }
    return `${minus}${(number / si[index].v)
      .toFixed(1)
      .replace(/\.0+$|(\.[0-9]*[1-9])0+$/, '$1')}${si[index].s}`
  }

  getPrecision(num: number, lowerThanZero = false) {
    const add = num >= 1 ? 1 : 2
    const precision = Math.floor(
      Math.floor(Math.log(num)) / Math.floor(Math.LN10),
    )
    if (lowerThanZero) {
      if (precision > 0) {
        return precision + add
      }
      return Math.abs(precision - add > 0 ? 0 : precision - add)
    }
    return precision + 2 < 0 ? 0 : precision + 2
  }

  convertPerc(num: number) {
    return this.round(num * 100, 2)
  }

  splitNumberToParts(n: number) {
    const wholeNumber = `${n}`.split('.')[0] || ''
    const decimal = `${n}`.split('.')[1] || ''
    return { wholeNumber, decimal }
  }

  splitBigNumberToParts(n: number) {
    const adjust = this.friendly(n)
    if (/[A-Za-z]/g.test(adjust.charAt(adjust.length - 1))) {
      return { wholeNumber: adjust, decimal: '' }
    }
    const wholeNumber = `${n}`.split('.')[0] || ''
    const decimal = `${n}`.split('.')[1] || ''
    return { wholeNumber, decimal }
  }

  convertString(s: string) {
    const tmp = parseFloat(s)
    return isNaN(tmp) ? 0 : tmp
  }

  stDev(array: number[]) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b, 0) / n
    return Math.sqrt(
      array.map((x) => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n,
    )
  }

  isZero(a: number) {
    return Math.abs(a) <= this.eps
  }

  gt(a: number, b: number) {
    return !this.isZero(a - b) && a > b
  }

  lt(a: number, b: number) {
    return !this.isZero(a - b) && a < b
  }

  lte(a: number, b: number) {
    return (!this.isZero(a - b) && a <= b) || this.isZero(a - b)
  }

  sharpeRatio(
    profit: number[],
    denominator: number,
    periodRatio: number,
    RFR = 2,
  ) {
    const profitPercByPeriod = profit.map((v) => v / denominator)
    const MR =
      profitPercByPeriod.reduce((acc, v) => (acc += v), 0) /
      profitPercByPeriod.length
    const SD = this.stDev(profitPercByPeriod)
    const rfr = RFR / 100 / periodRatio
    return SD !== 0 ? this.round((MR - rfr) / SD, 3) : 0
  }

  santinoRatio(
    profit: number[],
    denominator: number,
    periodRatio: number,
    RFR = 2,
    MAR = 7,
  ) {
    const profitPercByPeriod = profit.map((v) => v / denominator)
    const MR =
      profitPercByPeriod.reduce((acc, v) => (acc += v), 0) /
      profitPercByPeriod.length
    const rfr = RFR / 100 / periodRatio
    const mar = MAR / 100 / periodRatio
    const DD = Math.sqrt(
      profitPercByPeriod.reduce(
        (acc, v) => (acc += Math.min(0, v - mar) ** 2),
        0,
      ) / profitPercByPeriod.length,
    )
    return DD !== 0 ? this.round((MR - rfr) / DD, 3) : Infinity
  }

  countDecimals(number: number) {
    const str = number.toString()
    if (str.indexOf('.') !== -1) {
      return str.split('.')[1]?.length ?? 0
    }
    return 0
  }

  remainder(a: number, b: number) {
    const e = this.countDecimals(b)
    const multiplier = Number(`1e${e}`)
    return ((a * multiplier) % (b * multiplier)) / multiplier
  }
}
